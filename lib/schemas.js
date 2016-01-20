/**
 * @fileoverview This file defines the formats of Bossy definition object, parse options object
 *     and usage options object.
 */

// Load modules
// For definition object format validation.
var Joi = require('joi');


// Declare internals
var internals = {
    // valid key: alphanumeric, length >= 1 
    validKeyRegex: /^[a-zA-Z0-9][a-zA-Z0-9-]*$/
};

/**
 * The schema for a bossy definition object.
 * @public
 */
exports.definition = Joi.object({}).pattern(internals.validKeyRegex, Joi.object({
    alias: Joi.array().items(Joi.string().allow('')).single(),
    type: Joi.string().valid(['boolean', 'range', 'number', 'string', 'help']).default('string'),
    multiple: Joi.boolean(),
    description: Joi.string(),
    require: Joi.boolean(),
    default: Joi.any(),
    valid: Joi.array().items(Joi.any()).single()
}));

/**
 * The schema for a bossy parse options object.
 * @public
 */
exports.parseOptions = Joi.object({
    argv: Joi.array().items(Joi.string())
});

/**
 * The schema for a bossy usage options object.
 * @public
 */
exports.usageOptions = Joi.object({
    colors: Joi.boolean().allow(null)
});
