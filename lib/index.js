/**
 * @fileoverview Bossy, a command line options parser.
 * @module bossy
 */

// Load modules
// For the terminal command prompt.
var Tty = require('tty');
// For node utilities.
var Hoek = require('hoek');
// For definition object format validation.
var Joi = require('joi');
// For formats of Bossy definition object, parse options and usage options object.
var Schemas = require('./schemas');

// Declare internals
var internals = {};


/**
 * Parses command line arguments using a bossy definition object.
 * See README.md for the format of a definition object.
 * @param {Object} definition A bossy definition object that provides the command line options.
 * @param {Object?} options An optional configuration object that accepts a key "argv" for
 *     customized argv array value. If not provided defaults to process.argv.
 * @return the parsed process.argv for arguments provided. If there is an error then the
 *     return value will be an instanceof Error.
 * @public
 */
exports.parse = function (definition, options) {
    // Checks against invalid definition and options
    Joi.assert(definition, Schemas.definition, 'Invalid definition:');
    Joi.assert(options, Schemas.parseOptions, 'Invalid options argument:');

    // The result object that maps command line flags to argument values.
    var flags = {};
    // An object containing definitions for all  names/aliases in the definition object.
    var keys = {};

    definition = Joi.validate(definition, Schemas.definition).value;
    options = options || {};

    var names = Object.keys(definition);
    // Generates the key and flag mapping for each name/alias in the defnition object.
    for (var i = 0, il = names.length; i < il; ++i) {
        var name = names[i];
        var def = Hoek.clone(definition[name]);
        def.name = name;
        keys[name] = def;
        if (def.alias) {
            // Inserts an entry for each alias of the current option into keys.
            for (var a = 0, al = def.alias.length; a < al; ++a) {
                keys[def.alias[a]] = def;
            }
        }
        // Fills the boolean values meant by boolean type flags.
        if (def.type === 'boolean' && def.default !== undefined) {
            flags[name] = def.default;
        }
        else if (def.type === 'boolean') {
            flags[name] = false;
        }
    }

    // If options.argv not present then use process.argv.
    // Note the true command line arguments starts at index 2.
    var args = options.argv || process.argv.slice(2);
    // Last option that requires a value.
    var last = null;
    var errors = [];
    var help = false;

    // Processes each command line argument.
    for (i = 0, il = args.length; i < il; ++i) {
        var arg = args[i];
        if (arg[0] === '-') {
            // Arguments starting with '-' are keys.

            var char = arg[1];
            if (!char) {
                errors.push(internals.formatError('Invalid empty \'-\' option'));
                continue;
            }

            if (char === '-' && arg.length <= 2) {
                errors.push(internals.formatError('Invalid empty \'--\' option'));
                continue;
            }

            // Breaks up combined options to build an array of option flags.
            // Treats "-abc" as three options and "--abc" as one.
            var opts = (char === '-' ? [arg.slice(2)] : arg.slice(1).split(''));

            // Process each option flag.
            for (var p = 0, pl = opts.length; p < pl; ++p) {

                if (last) {  // A value is expected for the previous option.
                    errors.push(internals.formatError('Invalid option:', last.name, 'missing value'));
                    continue;
                }

                var opt = opts[p];
                def = keys[opt];
                if (!def) {
                    errors.push(internals.formatError('Unknown option:', opt));
                    continue;
                }

                if (def.type === 'help') {
                    flags[def.name] = true;
                    help = true;
                }
                else if (def.type === 'boolean') {
                    flags[def.name] = true;
                }
                else if (def.type === 'number' && pl > 1) {
                    // Inserts the number portion of this argument as the next argument.
                    args.splice(i + 1, 0, arg.split(char)[1]);
                    ++il;
                    // A value is expexted next.
                    last = def;
                    break;
                }
                else {
                    // A value is expexted next.
                    last = def;
                }
            }
        }
        else {
            // Arguments that do not start with '-' are values.

            var value = arg;
            if (last &&
                last.type) {

                if (last.type === 'number') {
                    value = parseInt(arg, 10);

                    if (!Hoek.isInteger(value)) {
                        errors.push(internals.formatError('Invalid value (non-number) for option:', last.name));
                        continue;
                    }
                }
            }

            // If a list of valid argument expected for last option
            if (last &&
                last.valid &&
                last.valid.indexOf(value) === -1) {

                errors.push(internals.formatError('Invalid value for option:', last.name));
                continue;
            }

            // Pushes values not associated with any flags to a array in field "_".
            name = last ? last.name : '_';
            if (flags.hasOwnProperty(name)) {
                // Field value already exists
                if (!last ||
                    last.multiple) {

                    flags[name].push(value);
                }
                else {
                    errors.push(internals.formatError('Multiple values are not allowed for option:', name));
                    continue;
                }
            }
            else {
                // Field value not present
                if (!last ||
                    last.multiple) {

                    flags[name] = [].concat(value);
                }
                else {
                    flags[name] = value;
                }
            }

            last = null;
        }
    }

    // Goes through all possible flags to handle a few special cases and fills alias mapping.
    for (i = 0, il = names.length; i < il; ++i) {
        def = keys[names[i]];
        if (def.type === 'range') {
            internals.parseRange(def, flags);
        }

        // Sets default values for non-existing arguments.
        if (flags[def.name] === undefined) {
            flags[def.name] = def.default;
        }

        // Error for missing required argument.
        if (def.require && flags[def.name] === undefined) {
            errors.push(internals.formatError(definition));
        }

        if (def.alias) {
            // Fills mappings of all the aliases with the same value.
            for (var d = 0, dl = def.alias.length; d < dl; ++d) {
                var alias = def.alias[d];
                flags[alias] = flags[def.name];
            }
        }
    }

    // Returns the first error if any
    if (errors.length && !help) { return errors[0]; }

    return flags;
};


/**
 * Formats a bossy definition object for display in the console.
 * See README.md for the format of a definition object.
 * @param {Object} definition A bossy definition object that provides the command line options.
 * @param {string?} usage A messeage to be displayed at the beginning.
 * @param {Object?} options An optional configuration object that accpet a field "colors",
 *     which etermines if colors are enabled when formatting usage. Defaults to whatever TTY supports.
 * @return the parsed process.argv for arguments provided. If there is an error then the
 *     return value will be an instanceof Error.
 * @public
 */
exports.usage = function (definition, usage, options) {

    // If usage not specified
    if ((arguments.length === 2) && (typeof usage === 'object')) {
        options = usage;
        usage = '';
    }

    Joi.assert(definition, Schemas.definition, 'Invalid definition:');
    Joi.assert(options, Schemas.usageOptions, 'Invalid options argument:');

    definition = Joi.validate(definition, Schemas.definition).value;
    options = Joi.validate(options || { colors: null }, Schemas.usageOptions).value;
    var color = internals.colors(options.colors);
    var output = usage ? 'Usage: ' + usage + '\n\n' : '\n';
    var col1 = ['Options:'];
    var col2 = ['\n'];

    var names = Object.keys(definition);
    // Fills the two columns with command line argument names and descriptions.
    for (var i = 0, il = names.length; i < il; ++i) {
        var name = names[i];
        var def = definition[name];

        // Formates name.
        var shortName = internals.getShortName(name, def.alias);
        var longName = (shortName === name) ? def.alias : name;

        var formattedName = '  -' + shortName;
        if (longName) {
            var aliases = [].concat(longName);
            for (var a = 0, al = aliases.length; a < al; ++a) {
                formattedName += ', --' + aliases[a];
            }
        }

        // Formates description.
        var formattedDesc = def.description ? color.gray(def.description) : '';
        if (def.default) {
            formattedDesc += formattedDesc.length ? ' ' : '';
            formattedDesc += color.gray('(' + def.default + ')');
        }
        if (def.require) {
            formattedDesc += formattedDesc.length ? ' ' : '';
            formattedDesc += color.yellow('(required)');
        }

        col1.push(color.green(formattedName));
        col2.push(formattedDesc);
    }

    return output + internals.formatColumns(col1, col2);
};


/**
 * Creates an Error object for the given definition.
 * @param {Array|string|Object} definition Used to generate error message.
 * @return {Error} An Error Object with a proper message.
 * @private
 */
internals.formatError = function (definition) {

    var msg = '';
    if (arguments.length > 1) {
        msg = Array.prototype.slice.call(arguments, 0).join(' ');
    }
    else if (typeof definition === 'string') {
        msg = definition;
    }
    else {
        msg = exports.usage(definition);
    }

    return new Error(msg);
};


/**
 * Gets the shortest name for the given name and set of name/aliases.
 * @param {string} shortName An command line option name.
 * @param {string?} aliases An array of aliases for the name.
 * @return {string} The shortest name/alias.
 * @private
 */
internals.getShortName = function (shortName, aliases) {

    if (!aliases) {
        return shortName;
    }
    // Finds the shortest alias/name.
    for (var i = 0, il = aliases.length; i < il; ++i) {
        if (aliases[i] && aliases[i].length < shortName.length) {
            shortName = aliases[i];
        }
    }

    return shortName;
};


/**
 * Formats columns texts.
 * @param {string} col1 Column 1 text.
 * @param {string} col2 Column 2 text.
 * @return {string} The formated combined text.
 * @private
 */
internals.formatColumns = function (col1, col2) {

    var rows = [];
    var col1Width = 0;
    col1.forEach(function (text) {

        if (text.length > col1Width) {
            col1Width = text.length;
        }
    });

    for (var i = 0, il = col1.length; i < il; ++i) {
        var row = col1[i];
        var padding = new Array((col1Width - row.length) + 5).join(' ');

        row += padding + col2[i];
        rows.push(row);
    }

    return rows.join('\n');
};


/**
 * Parses and stores a range of argument to be an array of numbers.
 * @param {Object} def Definition for the range option.
 * @param {Object} flags Place to store the ranged numbers.
 * @private
 */
internals.parseRange = function (def, flags) {

    var value = flags[def.name];
    if (!value) {
        return;
    }

    var values = [];
    var nums = [].concat(value).join(',');
    // Gets an array of each number range.
    var ranges = nums.match(/(?:\d+\-\d+)|(?:\d+)/g);
    // Process each range.
    for (var n = 0, nl = ranges.length; n < nl; ++n) {
        var range = ranges[n];

        range = range.split('-');
        var from = parseInt(range[0], 10);
        if (range.length === 2) {
            var to = parseInt(range[1], 10);
            // Pushes each number in range.
            if (from > to) {
                for (var r = from; r >= to; --r) {
                    values.push(r);
                }
            }
            else {
                for (r = from; r <= to; ++r) {
                    values.push(r);
                }
            }
        }
        else {
            values.push(from);
        }
    }

    flags[def.name] = values;
};


/**
 * Sets up colored printing functions for the console.
 * @param {boolean} enabled True if color mode is enabled.
 * @return A object that maps color names to functions that give the colored text.
 * @private
 */
internals.colors = function (enabled) {

    if (enabled === null) {
        enabled = Tty.isatty(1) && Tty.isatty(2);
    }

    var codes = {
        'black': 0,
        'gray': 90,
        'red': 31,
        'green': 32,
        'yellow': 33,
        'magenta': 35,
        'redBg': 41,
        'greenBg': 42
    };

    var colors = {};
    var names = Object.keys(codes);
    for (var i = 0, il = names.length; i < il; ++i) {
        var name = names[i];
        colors[name] = internals.color(name, codes[name], enabled);
    }

    return colors;
};


/**
 * @param {string} name Name of color.
 * @param {number} code A color code.
 * @param {boolean} enabled True if color mode is enabled.
 * @return A function that gives the colored text.
 * @private
 */
internals.color = function (name, code, enabled) {

    if (enabled) {
        var color = '\u001b[' + code + 'm';
        return function colorFormat (text) {

            return color + text + '\u001b[0m';
        };
    }

    return function plainFormat (text) {

        return text;
    };
};
