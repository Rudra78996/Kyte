#!/bin/sh

set -e

# Prevent nsjail payload (UID 99999) from reaching internal networks (SSRF prevention)
echo "Configuring iptables for SSRF prevention..."
iptables -A OUTPUT -m owner --uid-owner 99999 -d 10.0.0.0/8 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 172.16.0.0/12 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 192.168.0.0/16 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 169.254.0.0/16 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 127.0.0.0/8 -j REJECT

echo "Starting worker..."
exec npm run worker
