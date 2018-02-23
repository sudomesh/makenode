#!/bin/sh

BUG_NUMBER=$1
NODE_IP=$2

ssh root@$NODE_IP 'ash -s' < patch_deps.sh 
scp bug$BUG_NUMBER.patch root@$NODE_IP:~/patches/.
ssh root@$NODE_IP 'ash -s' < bug$BUG_NUMBER.sh
