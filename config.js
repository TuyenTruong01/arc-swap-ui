// config.js
// Tất cả thứ có thể thay đổi (branding, chain, contract, UX params) gom vào đây.

window.APP_CONFIG = {
  brand: {
    appName: "ArcSwap",
    logoPath: "./assets/logo.png",
    bgPath: "./assets/bg.png",
  },

  chain: {
    name: "Arc",
    chainIdDec: 5042002,
    chainIdHex: "0x4CEF52",
  },

  contracts: {
    USDC:   "0x3600000000000000000000000000000000000000",
    EURC:   "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    FXPOOL: "0x4837B7517d1721944Ac6B97576AC490adD4CfF69",
    HOUSE:  "0x2ffd2081E761Be95213d784dE8dB666Bb4545c45",
    BICY:   "0xd669f3AB72763381d52AB07Fb23e4ECfC0Bc6EC9",
    FAUCET: "0x42BaEee92C2C9f74F768Bff120469a4490CAC79D",
  },

  // FXPool: fxRate() trả về USDC per 1 EURC, scaled 1e18
  fx: {
    fxScale: 1e18,
  },

  ux: {
    slippageText: "Auto: 0.50%",
    lpRatioTolerance: 0.01, // ±1%
    gasBufferUsdc: 1.0,     // giữ USDC làm gas (Arc gas = USDC)
  },

  abiPaths: {
    erc20: "./abi/erc20.json",
    fxpool: "./abi/fxpool.json",
    faucet: "./abi/faucet.json",
  }
};
