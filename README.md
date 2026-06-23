# Ethernet Network Playground

A browser playground for experimenting with small Ethernet/IP networks. You can add hosts, switches, and routers; wire ports together; configure IPv4 addresses, masks, gateways, static routes, and ARP entries; then run simulated pings with packet traces.

## Run

```bash
npm install
npm run dev
```

## GitHub Pages Build

```bash
npm run build:pages
npm run preview:pages
```

Use `preview:pages` to inspect the generated `publish/` output locally. Opening `publish/index.html` directly can look different because browsers keep separate zoom settings for `file://`, `localhost`, and GitHub Pages origins.

## Included Simulation Concepts

- Ethernet links and switch broadcast domains
- Host IP address, mask, and default gateway configuration
- Router connected routes and static routes
- ARP request/reply and ARP cache updates
- ICMP echo path tracing with common failure explanations
