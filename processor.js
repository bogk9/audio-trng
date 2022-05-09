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

class LastByteExtractor extends Transform{
    constructor(){
        super();
    }
   _transform(chunk, enc, next){
        let buffer = new Uint8Array(1);
        let pushCount = 0;

        let b = Buffer.alloc(chunk.length/8);
        let offset = 0;

        for(let byte of chunk){     
            setBit(buffer, 0, pushCount, byte%2);
            pushCount++;

            if(pushCount === 8){
                b.writeUInt8(buffer[0], offset);
                offset++;
                pushCount=0;
            }   
        }
        this.push(b);
        next();
   }
}

// ----------------- driver code ---------------------------

const filterBoundaryBits = new Transformator((byte) => byte === 0 || byte === 255);
const sampleAndHold = new Transformator(() =>  Math.floor(Math.random() * 256)%2 );
const extractor = new LastByteExtractor();

console.time('Processing');

const exec = input
               .pipe(filterBoundaryBits) //0's and 255's rejected
               .pipe(sampleAndHold) //gets values for whose Math.random() * 256)%2 is truthy
               .pipe(extractor) //extracts last byte (%2)
               .pipe(output); //to file

exec.on('finish', () => { console.timeEnd('Processing');})
