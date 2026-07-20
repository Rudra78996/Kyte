#!/bin/sh

set -e

# The build payload needs Docker's embedded DNS, but may never send packets to
# loopback, RFC1918, link-local, carrier-grade NAT, multicast, or reserved IPs.
echo "Configuring isolated build egress policy..."
# Docker DNATs its embedded DNS port before the filter table, so allow the
# resolver's exact loopback address rather than matching destination port 53.
iptables -A OUTPUT -m owner --uid-owner 99999 -d 127.0.0.11/32 -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 0.0.0.0/8 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 10.0.0.0/8 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 172.16.0.0/12 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 192.168.0.0/16 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 169.254.0.0/16 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 100.64.0.0/10 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 127.0.0.0/8 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 224.0.0.0/4 -j REJECT
iptables -A OUTPUT -m owner --uid-owner 99999 -d 240.0.0.0/4 -j REJECT

ip6tables -A OUTPUT -m owner --uid-owner 99999 -d ::1/128 -j REJECT
ip6tables -A OUTPUT -m owner --uid-owner 99999 -d fc00::/7 -j REJECT
ip6tables -A OUTPUT -m owner --uid-owner 99999 -d fe80::/10 -j REJECT

echo "Starting isolated build runner..."
exec npm run build-runner
