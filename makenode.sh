#!/bin/sh 
# This script retrieves an IP address
# from a meshnode-database, running some version of
# https://github.com/sudomesh/meshnode-database
# Once an IP is retrieved, this script triggers 
# the configuration of this node with the correct
# MESH IP and other related settings stored in
# /opt/mesh/autoconf

set -x
set -e

# default configs for People's Open Network
LOG="./log.txt"
JSON="./node_info.json"
MESHNODEDB="secrets.peoplesopen.net"
MESHNODEDB_IP="138.68.252.190"
USER="deployer"
PASS="praisebob"
POSTURL="https://$USER:$PASS@$MESHNODEDB/nodes"

echo "retrieving an IP address from" $MESHNODEDB >>$LOG

# check for internet connection for every every 10s 
for i in 1 2 3 4 5;
do
  if ping -q -c 1 -W 1 8.8.8.8 >/dev/null; then
    echo "IPv4 is up" >>$LOG
    break
  else
    echo "IPv4 is down" >>$LOG
  fi
  sleep 10
done

if ping -q -c 1 -W 1 google.com >/dev/null; then
  echo "DNS is working" >>$LOG
else
  echo "DNS is not working" >>$LOG
  exit 1
fi

if ping -q -c 1 -W 1 $MESHNODEDB >/dev/null; then
  echo $MESHNODEDB "is reachable" >>$LOG
else
  echo $MESHNODEDB "is not reachable" >>$LOG
  echo "trying by IP" $MESHNODEDB_IP >>$LOG
  if ping -q -c 1 -W 1  $MESHNODEDB_IP >/dev/null; then
    echo $MESHNODEDB_IP "is reachable" >>$LOG
  else
    echo $MESHNODEDB_IP "is not reachable" >>$LOG
    exit 1
  fi
fi

# make a post request to meshnode-databse
echo "posting to" $POSTURL >>$LOG
MESHNODE_DATA=$(curl -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode data='{"type":"node"}' $POSTURL )

echo $MESHNODE_DATA > $JSON 

# parse the json response
MESH_IP=$(jq -r '.data.mesh_addr_ipv4' $JSON)
MESH_GW=$(jq -r '.data.open_subnet_ipv4' $JSON)
MESH_MASK=$(jq -r '.data.open_subnet_ipv4_bitmask' $JSON)
echo "recieved mesh IP:" $MESH_IP >>$LOG
echo "recieved mesh block:" $MESH_GW"/"$MESH_MASK >>$LOG

# execute autoconf on home node
ssh root@172.22.0.1 "/opt/mesh/autoconf $MESH_IP"

exit 0
