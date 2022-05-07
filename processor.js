const fs = require('fs');
const stream = require('stream');
var Transform = stream.Transform

const input = fs.createReadStream('./sample1', {encoding: null});
const output = fs.createWriteStream('output');

// -------------------------------------------

function setBit(buffer, i, bit, value){
    if(value == 0){
      buffer[i] &= ~(1 << bit);
    }else{
      buffer[i] |= (1 << bit);
    }
}  

/* 
Transformator odfiltrowuje bajty, dla których warunek nie zachodzi.
Warunek jako argument konstruktora.
*/

class Transformator extends Transform{
    constructor(condition){
        super();
        this.condition = condition;
    }
   _transform(chunk, enc, next){
        let b = Buffer.alloc(chunk.length);
        let offset = 0;
        for(let byte of chunk){
            if( this.condition(byte) )
                continue;
            b.writeUInt8(byte, offset);
            offset++;
        }
        const nb = b.slice(0, b.indexOf(0x00));
        this.push(nb);
        next();
   }
}

/* 
LastByteExtractor ekstraktuje tylko ostatni bit kazdej probki.
*/

class LastByteExtractor extends Transform{
    constructor(){
        super();
    }
   _transform(chunk, enc, next){
        let buffer = new Uint8Array(1);
        let pushCount = 0;

        let b = Buffer.alloc(chunk.length);
        let offset = 0;
        for(let byte of chunk){     
            setBit(buffer, 0, pushCount, byte%2);
            pushCount++;

            if(pushCount === 8){
                if(buffer[0] !== 0){
                    b.writeUInt8(buffer[0], offset);
                    offset++;
                }
                pushCount=0;
            }   
        }
        const nb = b.slice(0, b.indexOf(0x00));
        this.push(nb);
        next();
   }
}

// ----------------- driver code ---------------------------

const filterBoundaryBits = new Transformator((byte) => byte === 0 || byte === 255);
const sampleAndHold = new Transformator(() =>  Math.floor(Math.random() * 256)%2 );
const extractor = new LastByteExtractor();

console.time('Processing');

const exec = input.pipe(filterBoundaryBits)
               .pipe(sampleAndHold)
               .pipe(extractor)
               .pipe(output);

exec.on('finish', () => { console.timeEnd('Processing');})
