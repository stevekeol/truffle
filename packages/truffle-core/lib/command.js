const TaskError = require("./errors/taskerror");
const yargs = require("yargs/yargs");
const _ = require("lodash");
const version = require("../lib/version");
const OS = require("os");
const Config = require("truffle-config");

function Command(commands) {
  this.commands = commands;

  var args = yargs();

  Object.keys(this.commands).forEach(function(command) {
    args = args.command(commands[command]);
  });

  this.args = args;
}

Command.prototype.getCommand = function(inputStrings, options) {
  options = options || {};
  var argv = this.args.parse(inputStrings);

  if (argv._.length === 0) {
    return null;
  }

  var firstInputString = argv._[0];
  var chosenCommand = null;

  // If the command wasn't specified directly, go through a process
  // for inferring the command.
  if (this.commands[firstInputString]) {
    chosenCommand = firstInputString;
  } else if (options.noAliases !== true) {
    let config = Config.search(options);

    if (config) {
      config = Config.detect(options);
      if (config.commands) {
        this.commands = Object.assign(this.commands, config.commands);
      }
    }

    var currentLength = 1;
    var availableCommandNames = Object.keys(this.commands);

    // Loop through each letter of the input until we find a command
    // that uniquely matches.
    while (currentLength <= firstInputString.length) {
      // Gather all possible commands that match with the current length
      var possibleCommands = availableCommandNames.filter(function(
        possibleCommand
      ) {
        return (
          possibleCommand.substring(0, currentLength) ===
          firstInputString.substring(0, currentLength)
        );
      });

      // Did we find only one command that matches? If so, use that one.
      if (possibleCommands.length === 1) {
        chosenCommand = possibleCommands[0];
        break;
      }

      currentLength += 1;
    }
  }

  if (chosenCommand === null) {
    return null;
  }

  var command = this.commands[chosenCommand];

  return {
    name: chosenCommand,
    argv: argv,
    command: command
  };
};

Command.prototype.run = function(inputStrings, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  const result = this.getCommand(inputStrings, options);

  if (result === null) {
    return callback(
      new TaskError(
        "Cannot find command based on input: " + JSON.stringify(inputStrings)
      )
    );
  }

  var argv = result.argv;

  // Remove the task name itself.
  if (argv._) {
    argv._.shift();
  }

  // We don't need this.
  delete argv["$0"];

  // Some options might throw if options is a Config object. If so, let's ignore those options.
  var clone = {};
  Object.keys(options).forEach(function(key) {
    try {
      clone[key] = options[key];
    } catch (e) {
      // Do nothing with values that throw.
    }
  });

  options = _.extend(clone, argv);

  try {
    result.command.run(options, callback);
  } catch (err) {
    callback(err);
  }
};

Command.prototype.displayGeneralHelp = function() {
  const { bundled, core } = version.info();
  this.args
    .usage(
      "Truffle v" +
        (bundled || core) +
        " - a development framework for Ethereum" +
        OS.EOL +
        OS.EOL +
        "Usage: truffle <command> [options]"
    )
    .epilog("See more at http://truffleframework.com/docs")
    .showHelp();
};

module.exports = Command;
