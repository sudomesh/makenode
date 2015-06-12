#!/bin/sh

STATE=$1 # "up" when an ACK was received or "down" on physical disconnect
IFACE=$2 # The interface that received the ACK or physical disconnect
IP=$3 # The IP that was handed out to the $IFACE
NETMASK=$4 # The netmask that was handed out to $IFACE
PASSWORD=$5 # The password that was handed out to $IFACE (on STATE="up" only)

OPEN_IFACE="br-open" # The open bridge interface
OPEN_VLAN="10" # The VLAN ID of the br-open network

VLAN=${IFACE##*.} # The VLAN ID of the receiving interface 
PORT=$(expr "5" - "$VLAN") # The number of the receiving switch port

case $STATE in
    "up")
        
        # change the port to be tagged (same VLAN)
        swconfig dev switch0 vlan $VLAN set ports "0t ${PORT}t"

        # add the port to the br-open VLAN (VLAN 10)
        OLD_PORTS=$(swconfig dev switch0 vlan $OPEN_VLAN get ports)
        swconfig dev switch0 vlan $OPEN_VLAN set ports "$OLD_PORTS ${PORT}t"

        # apply the changes to the switch
        swconfig dev switch0 set apply

        # TODO add interface to babel
        ;;


    "down")

        # remove the port from the br-open VLAN (VLAN 10)
        OLD_PORTS=$(swconfig dev switch0 vlan $OPEN_VLAN get ports)
        NEW_PORTS=$(echo $OLD_PORTS | awk '{ sub(/ *${PORT}t? */, " ", $RESULT); print $RESULT }')
        swconfig dev switch0 vlan $OPEN_VLAN set ports "$NEW_PORTS"

        # change the port to be untagged (same VLAN)
        swconfig dev switch0 vlan $VLAN set ports "0t ${PORT}"

        # apply the changes to the switch
        swconfig dev switch0 set apply

        # TODO remove interface from babel
        ;;

    *)
        echo "Error: Unexpected state received" >&2
        
esac




