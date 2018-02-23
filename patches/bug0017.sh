#!/bin/sh

cd / 
patch -p1 < /root/patches/bug0017.patch
reboot now
