use anchor_lang::prelude::*;

// Stale: written when the program was deployed from a different machine.
declare_id!("2RqLJvV3du59cbgP5V7m9fwo382bsjw5oQReWEPRH3dH");

#[program]
pub mod app {
    pub fn hi(_ctx: Context<Hi>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hi {}
