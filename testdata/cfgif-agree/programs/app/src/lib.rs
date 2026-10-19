use anchor_lang::prelude::*;
use cfg_if::cfg_if;

cfg_if! {
    if #[cfg(feature = "mainnet-test")] {
        mod program_id {
            anchor_lang::declare_id!("J24jWEosQc5jgkdPm3YzNgzQ54CqNKkhzKy56XXJsLo2");
        }
    } else if #[cfg(feature = "devnet-dev")] {
        mod program_id {
            anchor_lang::declare_id!("devHfQHgiFNifkLW49RCXpyTUZMyKuBNnFSbrQ8XsbX");
        }
    } else {
        mod program_id {
            // The default (non-feature) build target — must win over first-match.
            anchor_lang::declare_id!("onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe");
        }
    }
}

#[program]
pub mod app {}
