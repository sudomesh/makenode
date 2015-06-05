#!/bin/sh

STATE=$1 # "up" when an ACK was received or "down" on physical disconnect
IFACE=$2 # The interface that received the ACK or physical disconnect
IP=$3 # The IP that was handed out to the $IFACE
NETMASK=$4 # The netmask that was handed out to $IFACE
PASSWORD=$5 # The password that was handed out to $IFACE (on STATE="up" only)

OPEN_IFACE="br-open" # The open bridge interface

case $STATE in
    "up")
        ip route add ${IP}/32 dev $OPEN_IFACE
        # TODO add interface to babel
        ;;


    "down")
        ip route del ${IP}/32 dev $OPEN_IFACE
        # TODO remove interface from babel
        ;;

    *)
        echo "Error: Unexpected state received" >&2
        
esac




