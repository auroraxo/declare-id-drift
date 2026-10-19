use anchor_lang::prelude::*;
use cfg_if::cfg_if;

cfg_if! {
    if #[cfg(feature = "a")] {
        anchor_lang::declare_id!("J24jWEosQc5jgkdPm3YzNgzQ54CqNKkhzKy56XXJsLo2");
    } else {
        anchor_lang::declare_id!("onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe");
    }
}

#[program]
pub mod app {}
