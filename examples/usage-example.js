/**
 * @fileoverview Example that demonstrates the "usage" method.
 * Run the script to see the result.
 */

var Bossy = require('../');
 
var definition = {
    n: {
        description: 'Input your name',
        alias: 'name'
    },
    p: {
        description: 'Specify a path',
        alias: ['path', 'dir']
    },
    t: {
        description: 'Specify a time',
        alias: 'time',
        type: 'number',
        require: true
    },
    h: {
        description: 'Show help',
        alias: 'help',
        type: 'boolean'
    }
};
 
// Prints the usage using the above definition.
console.log('Default:');
console.log(Bossy.usage(definition));

console.log('\nWith text:');
console.log(Bossy.usage(definition, 'Some text at the beginning.'));

console.log('\nWith option:');
console.log(Bossy.usage(definition, {colors: false}));

console.log('\nWith text and option:');
console.log(Bossy.usage(definition, 'Some text at the beginning.', {colors: false}));
