// script.js

(function () {
  const CFG = window.APP_CONFIG;
  if (!CFG) {
    alert("Missing APP_CONFIG. Check config.js loaded before script.js");
    return;
  }

  // ===== DOM =====
  const brandLogoEl = document.getElementById("brandLogo");
  const brandNameEl = document.getElementById("brandName");
  const cardTitleEl = document.getElementById("cardTitle");
  const networkNameEl = document.getElementById("networkName");

  const btnConnectTop = document.getElementById("btnConnectTop");
  const btnDisconnect = document.getElementById("btnDisconnect");

  const walletStatusEl = document.getElementById("walletStatus");
  const walletBalancesEl = document.getElementById("walletBalances");

  // Tabs
  const tabSwap = document.getElementById("tabSwap");
  const tabLiquidity = document.getElementById("tabLiquidity");
  const tabFaucet = document.getElementById("tabFaucet");
  const viewSwap = document.getElementById("view-swap");
  const viewLiquidity = document.getElementById("view-liquidity");
  const viewFaucet = document.getElementById("view-faucet");

  // Swap
  const toggleDirBtn = document.getElementById("toggleDirBtn");
  const btnSwitch = document.getElementById("btnSwitch");
  const amountInEl = document.getElementById("amountIn");
  const amountOutEl = document.getElementById("amountOut");
  const tokenFromEl = document.getElementById("tokenFrom");
  const tokenToEl = document.getElementById("tokenTo");
  const fromBalanceEl = document.getElementById("fromBalance");
  const toBalanceEl = document.getElementById("toBalance");
  const rateInfoEl = document.getElementById("rateInfo");
  const reserveInfoEl = document.getElementById("reserveInfo");
  const slippageValueEl = document.getElementById("slippageValue");
  const swapBtn = document.getElementById("swapBtn");
  const txStatusEl = document.getElementById("txStatus");

  // Liquidity
  const lpInfoEl = document.getElementById("lpInfo");
  const addUsdcInput = document.getElementById("addUsdcInput");
  const addEurcInput = document.getElementById("addEurcInput");
  const addLpBtn = document.getElementById("addLpBtn");
  const removeShareInput = document.getElementById("removeShareInput");
  const removeLpBtn = document.getElementById("removeLpBtn");
  const lpStatusEl = document.getElementById("lpStatus");

  // Faucet
  const claimHouseBtn = document.getElementById("claimHouseBtn");
  const claimBicyBtn = document.getElementById("claimBicyBtn");
  const faucetStatusEl = document.getElementById("faucetStatus");

  // ===== UI init from config =====
  function initBranding() {
    document.title = CFG.brand.appName;
    brandNameEl.textContent = CFG.brand.appName;
    cardTitleEl.textContent = CFG.brand.appName;
    networkNameEl.textContent = CFG.chain.name;

    if (CFG.brand.logoPath) brandLogoEl.src = CFG.brand.logoPath;

    if (CFG.ux?.slippageText) {
      slippageValueEl.textContent = CFG.ux.slippageText;
    }
  }

  // ===== Helpers =====
  function shortAddr(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  function setStatus(el, msg, isError = false) {
    el.textContent = msg || "";
    el.style.color = isError ? "rgba(180,20,40,0.85)" : "rgba(20,16,36,0.75)";
  }

  function setSwapDisabled(disabled, label) {
    swapBtn.classList.toggle("disabled", disabled);
    swapBtn.textContent = label;
  }

  function setActiveTab(name) {
    const tabs = [tabSwap, tabLiquidity, tabFaucet];
    tabs.forEach(t => t.classList.remove("tab--active"));
    viewSwap.classList.remove("view--active");
    viewLiquidity.classList.remove("view--active");
    viewFaucet.classList.remove("view--active");

    if (name === "swap") {
      tabSwap.classList.add("tab--active");
      viewSwap.classList.add("view--active");
    } else if (name === "liquidity") {
      tabLiquidity.classList.add("tab--active");
      viewLiquidity.classList.add("view--active");
    } else {
      tabFaucet.classList.add("tab--active");
      viewFaucet.classList.add("view--active");
    }
  }

  async function loadAbi(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Cannot load ABI: ${path}`);
    return await res.json(); // array of strings
  }

  // ===== Chain / wallet =====
  let provider = null;
  let signer = null;
  let userAddress = null;

  let ERC20_ABI = null;
  let FXPOOL_ABI = null;
  let FAUCET_ABI = null;

  let usdc = null, eurc = null, fxPool = null;
  let house = null, bicy = null, faucet = null;

  let usdcDecimals = 6, eurcDecimals = 6, houseDecimals = 18, bicyDecimals = 18;

  let usdcPerEurc = 1.165;
  let eurcPerUsdc = 1 / 1.165;

  // ===== Swap pair state (4 tokens) =====
  const TOKENS = ["USDC", "EURC", "HOUSE", "BICY"];

  let swapFrom = "USDC";
  let swapTo   = "EURC";

  let cachedBalances = { usdc: 0, eurc: 0, house: 0, bicy: 0 };

  // LP sync
  let isLpSyncing = false;
  let lastLpEdited = "USDC";

  async function ensureArcChain() {
    if (!window.ethereum) return;
    const net = await provider.getNetwork();
    if (Number(net.chainId) === CFG.chain.chainIdDec) return;

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chain.chainIdHex }]
    });
  }

  async function connectWallet() {
    try {
      setStatus(txStatusEl, "");
      if (!window.ethereum) {
        setStatus(txStatusEl, "No wallet found. Install Rabby / MetaMask / Bitget Wallet.", true);
        return;
      }

      // Load ABI once
      if (!ERC20_ABI || !FXPOOL_ABI || !FAUCET_ABI) {
        [ERC20_ABI, FXPOOL_ABI, FAUCET_ABI] = await Promise.all([
          loadAbi(CFG.abiPaths.erc20),
          loadAbi(CFG.abiPaths.fxpool),
          loadAbi(CFG.abiPaths.faucet),
        ]);
      }

      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      await ensureArcChain();

      const accounts = await provider.listAccounts();
      userAddress = accounts?.[0]?.address || null;
      signer = await provider.getSigner();

      if (!userAddress) {
        setStatus(txStatusEl, "Cannot read wallet address.", true);
        return;
      }

      // Update UI
      walletStatusEl.textContent = shortAddr(userAddress);
      btnConnectTop.textContent = shortAddr(userAddress);

      // Init contracts
      const C = CFG.contracts;
      usdc   = new ethers.Contract(C.USDC,   ERC20_ABI, signer);
      eurc   = new ethers.Contract(C.EURC,   ERC20_ABI, signer);
      fxPool = new ethers.Contract(C.FXPOOL, FXPOOL_ABI, signer);
      house  = new ethers.Contract(C.HOUSE,  ERC20_ABI, signer);
      bicy   = new ethers.Contract(C.BICY,   ERC20_ABI, signer);
      faucet = new ethers.Contract(C.FAUCET, FAUCET_ABI, signer);

      // Read decimals (fallback if fail)
      try {
        [usdcDecimals, eurcDecimals, houseDecimals, bicyDecimals] = await Promise.all([
          usdc.decimals(),
          eurc.decimals(),
          house.decimals(),
          bicy.decimals(),
        ]);
      } catch (e) {
        usdcDecimals = 6; eurcDecimals = 6; houseDecimals = 18; bicyDecimals = 18;
      }

      await Promise.all([
        refreshFxRateAndReserves(),
        refreshBalances(),
        refreshLpInfo(),
      ]);

      handleAmountChange();
      syncLpInputs(lastLpEdited);

      setSwapDisabled(false, "Enter an amount");
    } catch (e) {
      console.error(e);
      setStatus(txStatusEl, "Connect / network error.", true);
    }
  }

  function resetUI() {
    provider = null; signer = null; userAddress = null;
    usdc = eurc = fxPool = null;
    house = bicy = faucet = null;

    walletStatusEl.textContent = "Not connected";
    walletBalancesEl.textContent = "USDC: 0 · EURC: 0 · HOUSE: 0 · BICY: 0";
    btnConnectTop.textContent = "Connect Wallet";

    amountInEl.value = "";
    amountOutEl.value = "";
    setStatus(txStatusEl, "");
    setStatus(lpStatusEl, "");
    setStatus(faucetStatusEl, "");

    lpInfoEl.textContent = "0 / total 0";
    fromBalanceEl.textContent = "Balance: 0";
    toBalanceEl.textContent = "Balance: 0";

    rateInfoEl.textContent = "1 EURC ≈ ? USDC";
    reserveInfoEl.textContent = "Pool: ?";

    setSwapDisabled(true, "Connect wallet");
  }

  // ===== Swap UI behaviors (NEW 4-token pair logic) =====
  function updatePairPill(){
    toggleDirBtn.textContent = `⇅ ${tokenFromEl.value} → ${tokenToEl.value}`;
  }

  function applyPairToSelects() {
    tokenFromEl.value = swapFrom;
    tokenToEl.value   = swapTo;
    updatePairPill();
    refreshBalances().catch(() => {});
    handleAmountChange();
  }

  function switchDirection() {
    const a = tokenFromEl.value;
    const b = tokenToEl.value;
    swapFrom = b;
    swapTo   = a;
    applyPairToSelects();
  }

  function handleTokenFromChange() {
    const from = tokenFromEl.value;

    // nếu chọn trùng tokenTo thì auto đổi tokenTo sang token khác
    if (tokenToEl.value === from) {
      const next = TOKENS.find(t => t !== from) || "EURC";
      tokenToEl.value = next;
    }

    swapFrom = tokenFromEl.value;
    swapTo   = tokenToEl.value;
    updatePairPill();
    refreshBalances().catch(() => {});
    handleAmountChange();
  }

  function handleTokenToChange() {
    const to = tokenToEl.value;

    if (tokenFromEl.value === to) {
      const next = TOKENS.find(t => t !== to) || "USDC";
      tokenFromEl.value = next;
    }

    swapFrom = tokenFromEl.value;
    swapTo   = tokenToEl.value;
    updatePairPill();
    refreshBalances().catch(() => {});
    handleAmountChange();
  }

  // ===== Data refresh =====
  async function refreshBalances() {
    if (!userAddress || !usdc || !eurc || !house || !bicy) return;

    try {
      const [bUsdc, bEurc, bHouse, bBicy] = await Promise.all([
        usdc.balanceOf(userAddress),
        eurc.balanceOf(userAddress),
        house.balanceOf(userAddress),
        bicy.balanceOf(userAddress),
      ]);

      const usdcBal  = Number(ethers.formatUnits(bUsdc, usdcDecimals));
      const eurcBal  = Number(ethers.formatUnits(bEurc, eurcDecimals));
      const houseBal = Number(ethers.formatUnits(bHouse, houseDecimals));
      const bicyBal  = Number(ethers.formatUnits(bBicy, bicyDecimals));

      cachedBalances = { usdc: usdcBal, eurc: eurcBal, house: houseBal, bicy: bicyBal };

      walletBalancesEl.textContent =
        `USDC: ${usdcBal.toFixed(4)} · EURC: ${eurcBal.toFixed(4)} · HOUSE: ${houseBal.toFixed(2)} · BICY: ${bicyBal.toFixed(2)}`;

      // show balances based on selected tokens (4 token)
      function balOf(sym){
        if (sym === "USDC") return cachedBalances.usdc;
        if (sym === "EURC") return cachedBalances.eurc;
        if (sym === "HOUSE") return cachedBalances.house;
        if (sym === "BICY") return cachedBalances.bicy;
        return 0;
      }

      const fromBal = balOf(tokenFromEl.value);
      const toBal   = balOf(tokenToEl.value);

      const fmt = (sym, v) => {
        // stablecoin 4 decimals, others 2 decimals
        const d = (sym === "USDC" || sym === "EURC") ? 4 : 2;
        return `${v.toFixed(d)} ${sym}`;
      };

      fromBalanceEl.textContent = `Balance: ${fmt(tokenFromEl.value, fromBal)}`;
      toBalanceEl.textContent   = `Balance: ${fmt(tokenToEl.value, toBal)}`;
    } catch (e) {
      console.error("refreshBalances:", e);
    }
  }

  async function refreshFxRateAndReserves() {
    if (!fxPool || !usdc || !eurc) return;

    try {
      const rateRaw = await fxPool.fxRate(); // scaled 1e18
      usdcPerEurc = Number(rateRaw.toString()) / CFG.fx.fxScale;
      eurcPerUsdc = 1 / usdcPerEurc;

      const [rUsdc, rEurc] = await Promise.all([
        usdc.balanceOf(CFG.contracts.FXPOOL),
        eurc.balanceOf(CFG.contracts.FXPOOL),
      ]);

      const reserveUSDC = Number(ethers.formatUnits(rUsdc, usdcDecimals));
      const reserveEURC = Number(ethers.formatUnits(rEurc, eurcDecimals));

      rateInfoEl.textContent = `1 EURC ≈ ${usdcPerEurc.toFixed(4)} USDC`;
      reserveInfoEl.textContent = `Pool: ${reserveUSDC.toFixed(2)} USDC / ${reserveEURC.toFixed(2)} EURC`;
    } catch (e) {
      console.error("refreshFxRateAndReserves:", e);
      rateInfoEl.textContent = "1 EURC ≈ ? USDC";
      reserveInfoEl.textContent = "Pool: ?";
    }
  }

  async function refreshLpInfo() {
    if (!fxPool || !userAddress) return;

    try {
      const [total, mine] = await Promise.all([
        fxPool.totalShares(),
        fxPool.shares(userAddress),
      ]);
      const totalNum = Number(total.toString());
      const mineNum = Number(mine.toString());
      lpInfoEl.textContent = `${mineNum} / total ${totalNum}`;
    } catch (e) {
      console.error("refreshLpInfo:", e);
    }
  }

  // ===== Swap calc / action =====
  function handleAmountChange() {
    const val = parseFloat(amountInEl.value || "0");
    const from = tokenFromEl.value;
    const to   = tokenToEl.value;

    if (!val || val <= 0) {
      amountOutEl.value = "";
      if (!userAddress) setSwapDisabled(true, "Connect wallet");
      else setSwapDisabled(true, "Enter an amount");
      return;
    }

    // Only support USDC <-> EURC for now (current FXPOOL)
    const isFxPair =
      (from === "USDC" && to === "EURC") ||
      (from === "EURC" && to === "USDC");

    if (!isFxPair || !Number.isFinite(usdcPerEurc) || usdcPerEurc <= 0) {
      amountOutEl.value = "";
      setSwapDisabled(true, "Pair not supported yet");
      return;
    }

    let out = 0;
    if (from === "USDC" && to === "EURC") out = val * eurcPerUsdc;
    else out = val * usdcPerEurc;

    amountOutEl.value = out.toFixed(6);
    setSwapDisabled(!userAddress, userAddress ? "Swap" : "Connect wallet");
  }

  async function swapWithApprove(token, amount, decimals, dir) {
    const amountWei = ethers.parseUnits(amount.toString(), decimals);
    const allowance = await token.allowance(userAddress, CFG.contracts.FXPOOL);

    if (allowance < amountWei) {
      setStatus(txStatusEl, "Approving...");
      const txApprove = await token.approve(CFG.contracts.FXPOOL, amountWei);
      await txApprove.wait();
    }

    setStatus(txStatusEl, "Swapping...");
    let tx;
    if (dir === "USDC_TO_EURC") tx = await fxPool.swapUsdcForEurc(amountWei);
    else tx = await fxPool.swapEurcForUsdc(amountWei);

    const receipt = await tx.wait();
    txStatusEl.innerHTML = `Swap success ✅<br/>Tx: ${receipt.hash}`;
  }

  async function doSwap() {
    if (!userAddress || !signer) {
      setStatus(txStatusEl, "Please connect wallet first.", true);
      return;
    }
    const amount = parseFloat(amountInEl.value || "0");
    if (!amount || amount <= 0) {
      setStatus(txStatusEl, "Enter a valid amount.", true);
      return;
    }

    const from = tokenFromEl.value;
    const to   = tokenToEl.value;

    const isFxPair =
      (from === "USDC" && to === "EURC") ||
      (from === "EURC" && to === "USDC");

    if (!isFxPair) {
      setStatus(txStatusEl, "This pair is not supported yet (only USDC↔EURC now).", true);
      return;
    }

    try {
      setSwapDisabled(true, "Processing...");

      if (from === "USDC" && to === "EURC") {
        await swapWithApprove(usdc, amount, usdcDecimals, "USDC_TO_EURC");
      } else {
        await swapWithApprove(eurc, amount, eurcDecimals, "EURC_TO_USDC");
      }

      await Promise.all([
        refreshBalances(),
        refreshFxRateAndReserves(),
        refreshLpInfo(),
      ]);
      handleAmountChange();
    } catch (e) {
      console.error(e);
      setStatus(txStatusEl, "Swap failed or rejected.", true);
    } finally {
      setSwapDisabled(false, userAddress ? "Swap" : "Connect wallet");
    }
  }

  // ===== LP auto-ratio =====
  function syncLpInputs(changed) {
    if (isLpSyncing) return;
    isLpSyncing = true;

    try {
      const rate = usdcPerEurc; // 1 EURC = rate USDC
      if (!rate || !Number.isFinite(rate) || rate <= 0) return;

      if (changed === "USDC") {
        const usdcVal = parseFloat(addUsdcInput.value || "0");
        if (!usdcVal || usdcVal <= 0) addEurcInput.value = "";
        else addEurcInput.value = (usdcVal / rate).toFixed(6);
      } else {
        const eurcVal = parseFloat(addEurcInput.value || "0");
        if (!eurcVal || eurcVal <= 0) addUsdcInput.value = "";
        else addUsdcInput.value = (eurcVal * rate).toFixed(6);
      }
    } finally {
      isLpSyncing = false;
    }
  }

  async function addLiquidity() {
    if (!fxPool || !userAddress) {
      setStatus(lpStatusEl, "Connect wallet first.", true);
      return;
    }

    const usdcVal = parseFloat(addUsdcInput.value || "0");
    const eurcVal = parseFloat(addEurcInput.value || "0");
    if (!usdcVal || !eurcVal || usdcVal <= 0 || eurcVal <= 0) {
      setStatus(lpStatusEl, "Enter USDC & EURC amounts.", true);
      return;
    }

    // Keep some USDC for gas
    const gasBuffer = CFG.ux.gasBufferUsdc ?? 1.0;
    if (cachedBalances.usdc && usdcVal > (cachedBalances.usdc - gasBuffer)) {
      setStatus(lpStatusEl, `Not enough USDC (keep ~${gasBuffer} USDC for gas).`, true);
      return;
    }
    if (cachedBalances.eurc && eurcVal > cachedBalances.eurc) {
      setStatus(lpStatusEl, "Not enough EURC.", true);
      return;
    }

    // Validate ratio (± tolerance)
    const implied = usdcVal / eurcVal;
    const tol = CFG.ux.lpRatioTolerance ?? 0.01;
    const minR = usdcPerEurc * (1 - tol);
    const maxR = usdcPerEurc * (1 + tol);
    if (implied < minR || implied > maxR) {
      setStatus(lpStatusEl, `Wrong ratio. Need ~${usdcPerEurc.toFixed(4)} USDC per 1 EURC.`, true);
      return;
    }

    try {
      setStatus(lpStatusEl, "Approving & adding liquidity...");
      const usdcWei = ethers.parseUnits(usdcVal.toString(), usdcDecimals);
      const eurcWei = ethers.parseUnits(eurcVal.toString(), eurcDecimals);

      const [allowUsdc, allowEurc] = await Promise.all([
        usdc.allowance(userAddress, CFG.contracts.FXPOOL),
        eurc.allowance(userAddress, CFG.contracts.FXPOOL),
      ]);

      if (allowUsdc < usdcWei) {
        const txA = await usdc.approve(CFG.contracts.FXPOOL, usdcWei);
        await txA.wait();
      }
      if (allowEurc < eurcWei) {
        const txB = await eurc.approve(CFG.contracts.FXPOOL, eurcWei);
        await txB.wait();
      }

      const tx = await fxPool.addLiquidity(usdcWei, eurcWei);
      const receipt = await tx.wait();

      lpStatusEl.innerHTML = `Add LP success ✅<br/>Tx: ${receipt.hash}`;

      addUsdcInput.value = "";
      addEurcInput.value = "";

      await Promise.all([
        refreshBalances(),
        refreshFxRateAndReserves(),
        refreshLpInfo(),
      ]);
    } catch (e) {
      console.error(e);
      setStatus(lpStatusEl, e?.shortMessage || e?.reason || "Add LP failed or rejected.", true);
    }
  }

  async function removeLiquidity() {
    if (!fxPool || !userAddress) {
      setStatus(lpStatusEl, "Connect wallet first.", true);
      return;
    }

    const shareVal = parseFloat(removeShareInput.value || "0");
    if (!shareVal || shareVal <= 0) {
      setStatus(lpStatusEl, "Enter shares to remove.", true);
      return;
    }

    try {
      setStatus(lpStatusEl, "Removing liquidity...");
      const shareWei = BigInt(Math.floor(shareVal));
      const tx = await fxPool.removeLiquidity(shareWei);
      const receipt = await tx.wait();

      lpStatusEl.innerHTML = `Remove LP success ✅<br/>Tx: ${receipt.hash}`;
      removeShareInput.value = "";

      await Promise.all([
        refreshBalances(),
        refreshFxRateAndReserves(),
        refreshLpInfo(),
      ]);
    } catch (e) {
      console.error(e);
      setStatus(lpStatusEl, "Remove LP failed or rejected.", true);
    }
  }

  // ===== Faucet =====
  async function claimHouse() {
    if (!faucet || !userAddress) {
      setStatus(faucetStatusEl, "Connect wallet first.", true);
      return;
    }
    try {
      setStatus(faucetStatusEl, "Claiming HOUSE...");
      const tx = await faucet.claimHouse();
      const receipt = await tx.wait();
      faucetStatusEl.innerHTML = `Claim HOUSE success ✅<br/>Tx: ${receipt.hash}`;
      await refreshBalances();
    } catch (e) {
      console.error(e);
      setStatus(faucetStatusEl, "Claim HOUSE failed or rejected.", true);
    }
  }

  async function claimBicy() {
    if (!faucet || !userAddress) {
      setStatus(faucetStatusEl, "Connect wallet first.", true);
      return;
    }
    try {
      setStatus(faucetStatusEl, "Claiming BICY...");
      const tx = await faucet.claimBicy();
      const receipt = await tx.wait();
      faucetStatusEl.innerHTML = `Claim BICY success ✅<br/>Tx: ${receipt.hash}`;
      await refreshBalances();
    } catch (e) {
      console.error(e);
      setStatus(faucetStatusEl, "Claim BICY failed or rejected.", true);
    }
  }

  // ===== Events =====
  function attachEvents() {
    // tabs
    tabSwap.addEventListener("click", () => setActiveTab("swap"));
    tabLiquidity.addEventListener("click", () => setActiveTab("liquidity"));
    tabFaucet.addEventListener("click", () => setActiveTab("faucet"));

    // connect
    btnConnectTop.addEventListener("click", connectWallet);
    btnDisconnect.addEventListener("click", () => resetUI());

    // swap
    toggleDirBtn.addEventListener("click", switchDirection);
    btnSwitch.addEventListener("click", switchDirection);
    amountInEl.addEventListener("input", handleAmountChange);
    tokenFromEl.addEventListener("change", handleTokenFromChange);
    tokenToEl.addEventListener("change", handleTokenToChange); // NEW
    swapBtn.addEventListener("click", () => {
      if (swapBtn.classList.contains("disabled")) return;
      doSwap();
    });

    // faucet
    claimHouseBtn.addEventListener("click", claimHouse);
    claimBicyBtn.addEventListener("click", claimBicy);

    // LP ratio sync
    addUsdcInput.addEventListener("input", () => {
      lastLpEdited = "USDC";
      syncLpInputs("USDC");
    });
    addEurcInput.addEventListener("input", () => {
      lastLpEdited = "EURC";
      syncLpInputs("EURC");
    });
    addLpBtn.addEventListener("click", addLiquidity);
    removeLpBtn.addEventListener("click", removeLiquidity);

    // wallet events
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }

  // ===== Slippage UI (Option 1) =====
  let SLIP_MODE = "auto";       // "auto" | "preset" | "custom"
  let SLIP_VALUE = 0.5;         // number (%), used for preset/custom
  const SLIP_AUTO_VALUE = 0.5;  // Auto default shown

  const slipWrap  = document.getElementById("slippageWrap");
  const slipBtn   = document.getElementById("slippageBtn");
  const slipMenu  = document.getElementById("slippageMenu");
  const slipValue = document.getElementById("slippageValue");

  const slipCustomOpen  = document.getElementById("slipCustomOpen");
  const slipCustomBox   = document.getElementById("slipCustomBox");
  const slipCustomInput = document.getElementById("slipCustomInput");
  const slipCustomApply = document.getElementById("slipCustomApply");
  const slipHint        = document.getElementById("slipHint");

  function setSlipText(){
    if (SLIP_MODE === "auto") slipValue.textContent = `Auto: ${SLIP_AUTO_VALUE.toFixed(2)}%`;
    else if (SLIP_MODE === "custom") slipValue.textContent = `Custom: ${SLIP_VALUE}%`;
    else slipValue.textContent = `${SLIP_VALUE}%`;
  }

  function openSlipMenu(){
    slipWrap.classList.add("is-open");
    slipBtn.setAttribute("aria-expanded","true");
  }
  function closeSlipMenu(){
    slipWrap.classList.remove("is-open");
    slipBtn.setAttribute("aria-expanded","false");
    slipCustomBox.classList.remove("is-show");
  }
  function toggleSlipMenu(){
    if (slipWrap.classList.contains("is-open")) closeSlipMenu();
    else openSlipMenu();
  }

  function clampCustom(v){
    if (!Number.isFinite(v)) return null;
    if (v < 0.01) return 0.01;
    if (v > 50) return 50;
    // giữ tối đa 2 chữ số thập phân cho đẹp
    return Math.round(v * 100) / 100;
  }

  setSlipText();

  // Open/close
  slipBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSlipMenu();
  });

  // Click outside closes
  document.addEventListener("click", () => closeSlipMenu());
  slipMenu.addEventListener("click", (e) => e.stopPropagation());

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSlipMenu();
  });

  // Preset + Auto
  slipMenu.querySelectorAll(".slipItem[data-slip-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.slipMode;
      if (mode === "auto") {
        SLIP_MODE = "auto";
        SLIP_VALUE = SLIP_AUTO_VALUE;
        setSlipText();
        closeSlipMenu();
        return;
      }
      if (mode === "preset") {
        SLIP_MODE = "preset";
        SLIP_VALUE = Number(btn.dataset.slip || "0.5");
        // hiển thị gọn
        SLIP_VALUE = (Math.round(SLIP_VALUE * 100) / 100).toString();
        setSlipText();
        closeSlipMenu();
      }
    });
  });

  // Custom open
  slipCustomOpen.addEventListener("click", () => {
    slipCustomBox.classList.toggle("is-show");
    slipCustomInput.focus();
  });

  // Custom apply
  function applyCustom(){
    const raw = parseFloat((slipCustomInput.value || "").trim());
    const v = clampCustom(raw);
    if (v === null) {
      slipHint.textContent = "Invalid number. Example: 0.25";
      return;
    }
    slipHint.textContent = "Tip: Custom from 0.01% to 50%";
    SLIP_MODE = "custom";
    SLIP_VALUE = v.toString();
    setSlipText();
    closeSlipMenu();
    slipCustomInput.value = "";
  }

  slipCustomApply.addEventListener("click", applyCustom);
  slipCustomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyCustom();
  });

  // ===== Init =====
  initBranding();
  attachEvents();
  setActiveTab("swap");
  applyPairToSelects();   // CHANGED
  resetUI(); // sets initial button labels
})();
