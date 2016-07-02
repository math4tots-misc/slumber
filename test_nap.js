/* jshint esversion: 6 */


function assert(cond, message) {
  if (!cond) {
    throw new Error('Assertion error: ' + message);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error('Expected ' + expected + ' but got ' + actual);
  }
}

const nap = require('./nap.js');

//// lex test
{
let src = new nap.Source('<test>', `
a
  1.5 2 t.y * 'hoi'
`);

let tokens = nap.lex(src);

assertEqual(tokens.length, 13);
assertEqual(tokens[0].typ, 'NAME');
assertEqual(tokens[0].val, 'a');
assertEqual(tokens[1].typ, 'NEWLINE');
assertEqual(tokens[2].typ, 'INDENT');
assertEqual(tokens[3].typ, 'NUMBER');
assertEqual(tokens[3].val, 1.5);
assertEqual(tokens[4].typ, 'NUMBER');
assertEqual(tokens[4].val, 2);
assertEqual(tokens[5].typ, 'NAME');
assertEqual(tokens[5].val, 't');
assertEqual(tokens[6].typ, '.');
assertEqual(tokens[7].typ, 'NAME');
assertEqual(tokens[7].val, 'y');
assertEqual(tokens[8].typ, '*');
assertEqual(tokens[9].typ, 'STRING');
assertEqual(tokens[9].val, 'hoi');

}

console.log('test_nap pass!');
