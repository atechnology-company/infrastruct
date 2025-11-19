# Infrastruct V Server (Experimental)

> ⚠️ **Experimental**: This is an experimental V lang implementation of the Infrastruct backend. The Next.js version remains the primary production server.

## About

This is a V language implementation of the Infrastruct ALIF search engine backend, created for:
- Performance benchmarking
- Learning V's capabilities
- Exploring alternative architectures
- Potential future migration path

## Features

- ✅ Basic HTTP server with vweb
- ✅ API route stubs matching Next.js structure
- 🚧 Gemini AI integration (TODO)
- 🚧 Perplexity Search API (TODO)
- 🚧 Web scraping (TODO)
- 🚧 Query generation (TODO)

## Prerequisites

1. Install V: https://github.com/vlang/v
   ```bash
   git clone https://github.com/vlang/v
   cd v
   make
   sudo ./v symlink
   ```

2. Verify installation:
   ```bash
   v version
   ```

## Setup

1. Navigate to the V server directory:
   ```bash
   cd infrastruct-v
   ```

2. Build the server:
   ```bash
   v main.v
   ```

3. Run the server:
   ```bash
   ./main
   ```

   Or build and run in one step:
   ```bash
   v run main.v
   ```

The server will start on `http://localhost:3001`

## API Endpoints

All endpoints match the Next.js API structure:

- `GET /health` - Health check
- `POST /api/search` - Main search endpoint (TODO)
- `POST /api/perplexity-search` - Perplexity API integration (TODO)
- `POST /api/generate-queries` - Query generation (TODO)
- `GET /api/scrape-content?url=...` - Web scraping (TODO)

## Project Structure

```
infrastruct-v/
├── v.mod                 # V module configuration
├── main.v                # Main server entry point
├── src/
│   ├── routes/          # API route handlers (TODO)
│   ├── models/          # Data models
│   │   └── religion.v   # Religion types and structs
│   └── utils/           # Utility functions
│       └── http.v       # HTTP helpers
└── README.md
```

## Development

### Hot Reload
V doesn't have built-in hot reload, but you can use:
```bash
v watch run main.v
```

### Testing
```bash
v test .
```

### Building for Production
```bash
v -prod main.v
```

This creates an optimized binary with:
- Smaller file size
- Better performance
- No debug symbols

## Performance Goals

Target benchmarks vs Next.js:
- [ ] 10x faster startup time
- [ ] 5x lower memory usage
- [ ] 2x faster request handling
- [ ] Single binary deployment

## TODO

### High Priority
- [ ] Implement Gemini AI integration
- [ ] Implement Perplexity Search API
- [ ] Implement web scraping with cheerio equivalent
- [ ] Add proper error handling
- [ ] Add request validation

### Medium Priority
- [ ] Add logging
- [ ] Add rate limiting
- [ ] Add CORS support
- [ ] Add environment variable support
- [ ] Create comprehensive tests

### Low Priority
- [ ] Add metrics/monitoring
- [ ] Add Docker support
- [ ] Add CI/CD pipeline
- [ ] Performance benchmarks vs Next.js

## Why V?

V offers several advantages:
- **Fast compilation**: Compiles to native code in <1s
- **Small binaries**: ~1MB for simple servers
- **Low memory**: Minimal runtime overhead
- **Simple syntax**: Easy to learn and maintain
- **No GC pauses**: Manual memory management
- **Cross-platform**: Single binary for any OS

## Migration Strategy

If V proves successful:

1. **Phase 1**: Run both servers in parallel
2. **Phase 2**: Gradually migrate traffic to V
3. **Phase 3**: Keep Next.js for frontend, V for API
4. **Phase 4**: Full migration if beneficial

## Notes

- This is **experimental** - don't use in production yet
- Next.js remains the primary server
- Focus is on learning and benchmarking
- Breaking changes expected as V evolves

## Resources

- [V Documentation](https://github.com/vlang/v/blob/master/doc/docs.md)
- [vweb Framework](https://github.com/vlang/v/tree/master/vlib/vweb)
- [V Examples](https://github.com/vlang/v/tree/master/examples)

## License

MIT
