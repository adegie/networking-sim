# Ethernet Network Playground

A browser playground for experimenting with small Ethernet/IP networks. You can add hosts, switches, and routers; wire ports together; configure IPv4 addresses, masks, gateways, static routes, and ARP entries; then run simulated pings with packet traces.

## Run

```bash
npm install
npm run dev
```

## Included Simulation Concepts

- Ethernet links and switch broadcast domains
- Host IP address, mask, and default gateway configuration
- Router connected routes and static routes
- ARP request/reply and ARP cache updates
- ICMP echo path tracing with common failure explanations
