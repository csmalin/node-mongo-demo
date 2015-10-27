#!/bin/sh
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
/usr/bin/forever start /home/ubuntu/node-mongo-demo/current/bin/www
