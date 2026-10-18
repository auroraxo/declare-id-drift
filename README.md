# declare-id-drift

Cross-check four places a Solana Anchor program declares its own program ID, and
fail if they disagree. No RPC, no network — pure-file.

| Leg | Source | Where |
|-----|--------|-------|
| 1   | `declare_id!("…")` in the program's `lib.rs` | `programs/<name>/src/lib.rs` |
| 2   | Cluster entry in `Anchor.toml` | `Anchor.toml` |
| 3   | `address` field in the IDL JSON | `target/idl/<name>.json` |
| 4   | Deployed program account on the cluster | `target/deploy/<name>-keypair.json` (off-curve ed25519 pubkey) |

When all four agree, exit 0 with a one-line summary. When any leg is missing or
disagrees, the action fails (configurable) and prints a per-leg table that
points the maintainer at exactly the file/line that needs to change.

## Inputs

| Input            | Required | Default | Meaning |
|------------------|----------|---------|---------|
| `program`        | yes      | —       | Program name (matches `Anchor.toml [programs.<cluster>]` key, the `declare_id!` crate name, the IDL file stem, and the keypair file stem). |
| `cluster`        | no       | `mainnet` | Which `[programs.<cluster>]` entry of `Anchor.toml` to compare against. |
| `anchor-toml`    | no       | `Anchor.toml` | Path to Anchor.toml. |
| `lib-rs`         | no       | `programs/<program>/src/lib.rs` | Path to the program's `lib.rs` containing `declare_id!`. |
| `idl`            | no       | `target/idl/<program>.json` | Path to the IDL JSON. |
| `keypair`        | no       | `target/deploy/<program>-keypair.json` | Path to the deployed program keypair (used as ground truth when present). |
| `fail-on-drift`  | no       | `true` | Fail the step when legs disagree. |
| `fail-on-missing`| no       | `false` | Fail the step when one or more legs are absent. |

If a leg file is missing and `fail-on-missing` is `false`, that leg is reported
as `absent` and is excluded from the agreement check.

## Why

Anchor programs drift because the four files above are edited by hand, in
different tools, often by different people, on different schedules. The drift
is invisible until deploy — the on-chain program is whatever the deployer
uploaded, and the committed IDL is whatever `anchor build` produced last.

`declare-id-drift` runs the four-way check on every PR, so drift is caught at
review time instead of at deploy time.

## Why no on-chain leg

An on-chain leg would need RPC and a `Buffer` / program account lookup. The
senzenn/idl-drift Action already does that for the IDL account specifically.
This Action stays purely file-based so it can run in any CI with no
credentials.

## Usage

```yaml
- uses: auroraxo/declare-id-drift@v1
  with:
    program: my_program
    cluster: mainnet
```

Pin to a major version: `@v1`. The action is self-contained — single
`action.yml`, single `src/index.mjs`, zero npm dependencies.

## Local run

```sh
node test/run.mjs
```

Exits non-zero on the first fixture that disagrees; prints the per-leg table.

## License

MIT.
