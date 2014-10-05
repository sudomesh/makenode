This is a node.js command line utility for configuring new sudo mesh nodes.

Early alpha status. Things may break.

# About

makenode combines a set of configuration file templates with information like generated SSH keys, assigned IP address ranges, private wifi pasword, etc. then bundles the resulting configuration files into an ipk package, sends the ipk to the node using scp and installs the package. makenode can also optionally flash the node using the sudomesh firmware to prepare it for configuration.

# Usage

```
Usage: ./makenode.js

Options:
  --firmware: Flash firmware before configuring. See ubi-flasher for relevant command line arguments.
  --ip: Router IP address (default: 192.168.13.37)
  --port: SSH port (default: 22)
  --password: SSH root password (default: meshtheplanet)
  --detectOnly: Report hardware detection results and exit.
  --detectOnlyJSON <file>: Write hardware detection results in JSON format to file and exit.
  --hwInfo <file>: Read hardware info results from file instead of detecting.
  --offline: Prompt user for the parameters usually provided by the meshnode database.
  --ipkOnly: Generate .ipk file but don't automatically upload or install to node.
```

Defaults and other settings can be overwritten in the settings.js file.


# Details

makenode gathers data in the following ways

* Hardware detection by running commands on the node
* User input
* Requesting unique IP assignment from a remote meshnode database
* Key generation (for SSH host keys)
* Password generation (human readable or XKCD style)

The data is gathered and combined with templates by recursively walking through the configs/ dir and subdirs. For each dir the following occurs:

If present, the config.js file is imported and the function it exports is run. That function will receive the hardware info gathered during hardware detection (the hwInfo object) and can run information gathering functions (or schedule async information gathering to be run later) and return a configuration object with values to be combined with template files. If a templates/ directory exists in the same subdir as a config.js file, and the config.js file does not return null, then those templates are included in the ipk. This allows the inclusion of different versions of configuration templates based on e.g. user input or hardware.

The config objects returned from all config.js files are combined into a single config object and all templates (except for those that were ignored) are combined with the config object using the underscore.js template compiler. 

The resulting files are packaged as an ipk, sent to the node and installed.

## Offline Mode

Usage: ./makenode.js --offline offlineConfig.json

offlineConfig.json contains object properties that you'd like to override/set.
offlineConfig.json is a sample of such a file.
Looking through /configs/templates/\* will give you a pretty good idea of what variables are templated and can be set. Adding templated
variables in those files and then adding them to offlineConfig.json *should* add those variables to the configured node.

# License

GPLv3

Copyright 2014 Marc Juul
