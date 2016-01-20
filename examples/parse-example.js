/**
 * @fileoverview Example that demonstrates the "parse" method.
 * Run this script, try different command line flags to see the results.
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
 
 
var args = Bossy.parse(definition);
 
// Prints error message if any.
if (args instanceof Error) {
    console.error(args.message);
    return;
}

// Pretty-prints the result object.
console.log(JSON.stringify(args, null, 2));
