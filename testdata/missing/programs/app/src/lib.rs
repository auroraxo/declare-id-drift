use anchor_lang::prelude::*;

declare_id!("925M4ZRm2VTD5ru6nL4h6h6Ls629GJoV3rQmvGsqmZo1");

#[program]
pub mod app {
    pub fn hi(_ctx: Context<Hi>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hi {}
