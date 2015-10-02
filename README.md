This is a node.js command line utility for configuring new sudo mesh nodes.

Early alpha status. Things may break.

# About

makenode combines a set of configuration file templates with information like generated SSH keys, assigned IP address ranges, private wifi pasword, etc. then bundles the resulting configuration files into an ipk package, sends the ipk to the node using scp and installs the package. makenode can also optionally flash the node using the sudomesh firmware to prepare it for configuration.

# Install Dependencies

System dependencies

* dropbear

```
sudo apt-get install dropbear
OR
brew install dropbear
```

* fakeroot

```
sudo apt-get install fakeroot
OR
brew install fakeroot
```

Install node.js packages:

```
npm install
```

# Settings

Copy and tweak settings file

```
cp settings.js.example settings.js
```

Add your public ssh key to `./configs/authorized_keys`

# Usage

```
Usage: ./makenode.js

Options:
  --firmware: Flash firmware before configuring. See ubi-flasher for relevant command line arguments.
  --ip: Router IP address (default: 172.22.0.1)
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

Here's a sample offlineConfig.json file with commenting because we can't have comments in a json file:
```
{ 
  "mesh_addr_ipv4": "100.1.2.65",
  "mesh_subnet_ipv4": "100.0.0.0",
  "mesh_subnet_ipv4_bitmask": "12",
  "mesh_subnet_ipv4_mask": "255.240.0.0",
  "adhoc_addr_ipv4": "100.1.2.65",
  "adhoc_subnet_ipv4_bitmask": "32",
  "adhoc_subnet_ipv4_mask": "255.255.255.255",
  "tun_addr_ipv4": "100.1.2.65",
  "tun_subnet_ipv4_bitmask": "32",
  "tun_subnet_ipv4_mask": "255.255.255.255",
  "open_addr_ipv4": "100.1.2.65",
  "open_subnet_ipv4": "100.1.2.64",
  "open_subnet_ipv4_mask": "255.255.255.192",
  "open_subnet_ipv4_bitmask": "26",
  "mesh_addr_ipv6": "a237:473:2349:a1::30:1:92",
  "exit_node_mesh_ipv4_addr": "100.0.0.1",
  "relay_node_inet_ipv4_addr": "104.236.181.226",
  "tx_power": "20",
  "id": "Sudomesh-Node-Sample",
  "operator": {
        "name": "Sample Node Operator",
        "email": "node_operator1@sudomesh.org",
        "phone": null
    }
}
```

# License

GPLv3

Copyright 2014 Marc Juul
