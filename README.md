# Ethernet Network Playground

A browser playground for experimenting with Ethernet/IP networks and AWS VPC networking. The Ethernet lab supports hosts, switches, routers, ARP, NAT, and pings. The AWS lab models VPCs, subnets, route tables, IGWs, NAT Gateways, ALBs, EC2 instances, security groups, and packet traces.

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
- AWS VPC CIDRs, public/private/data subnets, and route tables
- AWS Internet Gateway, NAT Gateway, ALB, EC2, security group, and NACL path checks
