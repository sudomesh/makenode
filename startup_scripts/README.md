This directory contains startup script(s) to automatically start meshnode-database.

# Upstart 

The Upstart script uses [Forever](https://github.com/nodejitsu/forever) to automatically restart the meshnode-database if it for some reason crashes.

To install and start do:

```
sudo npm -g install forever
sudo cp meshnode-database.conf /etc/init
start meshnode-database
```
