# Haven

A real-time communication platform with a Vite/TypeScript client and Go relay server.

## Structure

- `client/` - Frontend (Vite + TypeScript)
- `relay/` - Backend relay server (Go)

## Quick Start

### Client
```bash
cd client
npm install
npm run dev
```

### Relay Server
```bash
cd relay
go build -o haven
./haven
```

## License

MIT
