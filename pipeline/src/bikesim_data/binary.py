"""network.bin: the street network as typed arrays, ~5x smaller than network.json before gzip.

Little-endian layout, every section 4-byte aligned (lib/engine/net.ts `parseNetBin` reads it):

    "BSN1"  u32 version=1  u32 nNodes  u32 nEdges  u32 nPoints  u32 metaBytes
    i32[nNodes]  node lon, microdegrees          i32[nNodes]  node lat
    i32[nEdges]  u      i32[nEdges]  v           f32[nEdges]  length m
    i32[nEdges]  name index                      i32[nEdges]  block index
    u8[nEdges]   lts    u8[nEdges]   src         (each padded to 4)
    u32[nEdges+1] point offset per edge
    i32[2*nPoints] edge points, microdegrees, delta-coded within each edge (first point absolute)
    utf-8 JSON {names, src}, metaBytes long
"""

from __future__ import annotations

import json
import struct
from array import array
from pathlib import Path

MAGIC, VERSION = b"BSN1", 1


def _pad(buf: bytearray) -> None:
    buf.extend(b"\0" * (-len(buf) % 4))


def write_network_bin(path: Path, lon: list[float], lat: list[float], edges: list[list], names: list[str], src: list[str]) -> int:
    n_nodes, n_edges = len(lon), len(edges)
    offsets = array("I", [0])
    pts = array("i")
    for e in edges:
        flat = e[7]
        px = py = 0
        for k in range(0, len(flat), 2):
            x, y = round(flat[k] * 1e6), round(flat[k + 1] * 1e6)
            pts.append(x - px)
            pts.append(y - py)
            px, py = x, y
        offsets.append(len(pts) // 2)
    meta = json.dumps({"names": names, "src": src}, separators=(",", ":")).encode()

    buf = bytearray(MAGIC)
    buf += struct.pack("<5I", VERSION, n_nodes, n_edges, offsets[-1], len(meta))
    for arr in (array("i", (round(x * 1e6) for x in lon)), array("i", (round(y * 1e6) for y in lat)),
                array("i", (e[0] for e in edges)), array("i", (e[1] for e in edges)),
                array("f", (e[2] for e in edges)),
                array("i", (e[5] for e in edges)), array("i", (e[6] for e in edges))):
        buf += arr.tobytes()
    for col in (3, 4):
        buf += bytes(e[col] for e in edges)
        _pad(buf)
    buf += offsets.tobytes()
    buf += pts.tobytes()
    buf += meta
    path.write_bytes(bytes(buf))
    return len(buf)


def read_network_bin(path: Path) -> dict:
    """Round-trip reader for tests: returns the network.json shape."""
    b = path.read_bytes()
    assert b[:4] == MAGIC
    ver, nn, ne, npts, mlen = struct.unpack_from("<5I", b, 4)
    o = 24

    def take(code: str, n: int):
        nonlocal o
        a = array(code)
        a.frombytes(b[o:o + n * a.itemsize])
        o += n * a.itemsize
        o += -o % 4
        return a

    lon, lat = take("i", nn), take("i", nn)
    u, v, ln, nm, bl = take("i", ne), take("i", ne), take("f", ne), take("i", ne), take("i", ne)
    lts, sr = take("B", ne), take("B", ne)
    off, pts = take("I", ne + 1), take("i", 2 * npts)
    meta = json.loads(b[o:o + mlen])
    edges = []
    for i in range(ne):
        flat, px, py = [], 0, 0
        for k in range(off[i], off[i + 1]):
            px += pts[2 * k]
            py += pts[2 * k + 1]
            flat += [px / 1e6, py / 1e6]
        edges.append([u[i], v[i], ln[i], lts[i], sr[i], nm[i], bl[i], flat])
    return {"nodes": {"lon": [x / 1e6 for x in lon], "lat": [y / 1e6 for y in lat]}, "edges": edges, **meta}
