#!/bin/sh

STATE=$1 # "up" when an ACK was received or "down" on physical disconnect
IFACE=$2 # The interface that received the ACK or physical disconnect
IP=$3 # The IP that was handed out to the $IFACE
NETMASK=$4 # The netmask that was handed out to $IFACE
PASSWORD=$5 # The password that was handed out to $IFACE (on STATE="up" only)


case $STATE in
    "up")
        # 
        


        ;;


    "down")
        # TODO Remove interfaces from bridges

        # TODO Remove bridges

        # TODO Bring down wifi interfaces

        # Remove the VLAN interfaces
        ip link del dev $MESH_IFACE
        ip link del dev $OPEN_IFACE

        ;;

    *)
        echo "Error: Unexpected state received" >&2
        
esac




