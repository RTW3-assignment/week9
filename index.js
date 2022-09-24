const BigNumber = require('bignumber.js');
const qs = require('qs');
const web3 = require('web3');

// state to track user choice
let currentSelectSide;   //click on from_token /  to_token
let currentTrade = {};    //select which token
let currentAmountSide;   //blur on from_amount / to_aount
let base0xUrl = "https://api.0x.org";
// let base0xUrl = "https://ropsten.api.0x.org";
// let tokenListsUrl = "https://tokens.coingecko.com/uniswap/all.json";
let tokenListsUrl = "http://tokens.uniswap.org.ipns.localhost:8080/";
// let tokenListsUrl = "https://wispy-bird-88a7.uniswap.workers.dev/?url=http://tokens.1inch.eth.link";
// let sources = {}; //map to store quota sources

//-------------------------------------------------------
//--------------define of function----------------
//-------------------------------------------------------

async function connect() {
    /** MetaMask injects a global API into websites visited by its users at `window.ethereum`. This API allows websites to request users' Ethereum accounts, read data from blockchains the user is connected to, and suggest that the user sign messages and transactions. The presence of the provider object indicates an Ethereum user. Read more: https://ethereum.stackexchange.com/a/68294/85979**/

    // Check if MetaMask is installed, if it is, try connecting to an account
    if (typeof window.ethereum !== "undefined") {
        try {
            console.log("connecting");
            // Requests that the user provides an Ethereum address to be identified by. The request causes a MetaMask popup to appear. Read more: https://docs.metamask.io/guide/rpc-api.html#eth-requestaccounts
            await ethereum.request({ method: "eth_requestAccounts" });
        } catch (error) {
            console.log(error);
        }
        // If connected, change button to "Connected"
        document.getElementById("login_button").innerHTML = "Connected";
        // If connected, enable "Swap" button
        document.getElementById("swap_button").disabled = false;
    }
    // Ask user to install MetaMask if it's not detected 
    else {
        document.getElementById("login_button").innerHTML =
            "Please install MetaMask";
    }
}

//function to open modal
function openModal(side) {
    currentSelectSide = side;
    document.getElementById("token_modal").style.display = "block";
}
function closeModal() {
    // currentSelectSide = "";  no need to clear state
    document.getElementById("token_modal").style.display = "none";
}

async function init() {
    listAvailableTokens();
}

//function to request token list
async function listAvailableTokens() {
    console.log("initializing");
    let response = await fetch(tokenListsUrl);
    let tokenListJSON = await response.json();
    console.log("listing available tokens: ", tokenListJSON);
    tokens = tokenListJSON.tokens
    console.log("tokens:", tokens);

    // Create a token list for the modal
    let parent = document.getElementById("token_list");
    // Loop through all the tokens inside the token list JSON object
    for (const i in tokens) {
        // Create a row for each token in the list
        let div = document.createElement("div");
        div.className = "token_row";
        // For each row, display the token image and symbol
        let html = `
    <img class="token_list_img" src="${tokens[i].logoURI}">
      <span class="token_list_text">${tokens[i].symbol}</span>
      `;
        div.innerHTML = html;
        div.onclick = () => {
            selectToken(tokens[i]);
        };
        parent.appendChild(div);
    }
}

//function to store selected token info
function selectToken(token) {
    // Track which side of the trade we are on - from/to
    currentTrade[currentSelectSide] = token;
    // Log the selected token
    console.log("currentTrade:", currentTrade);

    // close modal after stored select token info.
    closeModal();

    //
    renderInterface();
}

// Function to display the image and token symbols 
function renderInterface() {
    if (currentTrade.from_token) {
        console.log(currentTrade.from_token)
        // Set the from token image
        document.getElementById("from_token_img").src = currentTrade.from_token.logoURI;
        // Set the from token symbol text
        document.getElementById("from_token_text").innerHTML = currentTrade.from_token.symbol;
    }
    if (currentTrade.to_token) {
        // Set the to token image
        document.getElementById("to_token_img").src = currentTrade.to_token.logoURI;
        // Set the to token symbol text
        document.getElementById("to_token_text").innerHTML = currentTrade.to_token.symbol;
    }
}

async function getPrice(side) {
    console.log("Getting Price");
    if (side === "from_amount") {
        // Only fetch price if from token, to token, and from token amount have been filled in 
        if (!currentTrade.from_token || !currentTrade.to_token || !document.getElementById("from_amount").value) return;
        // The amount is calculated from the smallest base unit of the token. We get this by multiplying the (from amount) x (10 to the power of the number of decimal places)
        let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from_token.decimals);

        const params = {
            sellToken: currentTrade.from_token.symbol,
            buyToken: currentTrade.to_token.symbol,
            sellAmount: amount,
        }
        // Fetch the swap price.
        const response = await fetch(
            `${base0xUrl}/swap/v1/price?${qs.stringify(params)}`
        );

        swapPriceJSON = await response.json();
        console.log("Price: ", swapPriceJSON);
        // Use the returned values to populate the buy Amount and the estimated gas in the UI
        document.getElementById("to_amount").value = swapPriceJSON.buyAmount / (10 ** currentTrade.to_token.decimals);
        document.getElementById("gas_estimate").innerHTML = swapPriceJSON.estimatedGas;
    } else {
        if (!currentTrade.from_token || !currentTrade.to_token || !document.getElementById("to_amount").value) return;
        // The amount is calculated from the smallest base unit of the token. We get this by multiplying the (from amount) x (10 to the power of the number of decimal places)
        let amount = Number(document.getElementById("to_amount").value * 10 ** currentTrade.to_token.decimals);

        const params = {
            sellToken: currentTrade.from_token.symbol,
            buyToken: currentTrade.to_token.symbol,
            buyAmount: amount,
        }
        // Fetch the swap price.
        const response = await fetch(
            `${base0xUrl}/swap/v1/price?${qs.stringify(params)}`
        );

        swapPriceJSON = await response.json();
        console.log("Price: ", swapPriceJSON);
        // Use the returned values to populate the buy Amount and the estimated gas in the UI
        document.getElementById("from_amount").value = swapPriceJSON.sellAmount / (10 ** currentTrade.from_token.decimals);
        document.getElementById("gas_estimate").innerHTML = swapPriceJSON.estimatedGas;
    }
}

// Function to get a quote using /swap/v1/quote. We will pass in the user's MetaMask account to use as the takerAddress
async function getQuote(account) {
    console.log("Getting Quote");

    if (!currentTrade.from_token || !currentTrade.to_token || !document.getElementById("from_amount").value) return;
    let amount = Number(document.getElementById("from_amount").value * 10 ** currentTrade.from_token.decimals);

    const params = {
        sellToken: currentTrade.from_token.symbol,
        buyToken: currentTrade.to_token.symbol,
        sellAmount: amount,
        // Set takerAddress to account 
        takerAddress: account,
    }

    // Fetch the swap quote.
    const response = await fetch(
        `${base0xUrl}/swap/v1/quote?${qs.stringify(params)}`
    );

    swapQuoteJSON = await response.json();
    console.log("Quote: ", swapQuoteJSON);

    document.getElementById("to_amount").value = swapQuoteJSON.buyAmount / (10 ** currentTrade.to_token.decimals);
    document.getElementById("gas_estimate").innerHTML = swapQuoteJSON.estimatedGas;

    return swapQuoteJSON;
}

//function to swap token
async function trySwap() {
    // The address, if any, of the most recently used account that the caller is permitted to access
    let accounts = await ethereum.request({ method: "eth_accounts" });
    let takerAddress = accounts[0];
    // Log the the most recently used address in our MetaMask wallet
    console.log("takerAddress: ", takerAddress);


    // Setup the erc20abi in json format so we can interact with the approve method below
    const erc20abi = [{ "inputs": [{ "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "uint256", "name": "max_supply", "type": "uint256" }], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "burnFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "subtractedValue", "type": "uint256" }], "name": "decreaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "addedValue", "type": "uint256" }], "name": "increaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }]
    // Set up approval amount for the token we want to trade from
    const fromTokenAddress = currentTrade.from_token.address;

    // In order for us to interact with a ERC20 contract's method's, need to create a web3 object. This web3.eth.Contract object needs a erc20abi which we can get from any erc20 abi as well as the specific token address we are interested in interacting with, in this case, it's the fromTokenAddrss
    // Read More: https://web3js.readthedocs.io/en/v1.2.11/web3-eth-contract.html#web3-eth-contract
    const web3 = new Web3(Web3.givenProvider);
    const ERC20TokenContract = new web3.eth.Contract(erc20abi, fromTokenAddress);
    console.log("setup ERC20TokenContract: ", ERC20TokenContract);

    const maxApproval = new BigNumber(2).pow(256).minus(1);
    console.log("approval amount: ", maxApproval);

    // Grant the allowance target (the 0x Exchange Proxy) an  allowance to spend our tokens. Note that this is a txn that incurs fees. 
    const tx = await ERC20TokenContract.methods.approve(
        swapPriceJSON.allowanceTarget,
        swapPriceJSON.allowanceTarget,
    )
        .send({ from: takerAddress })
        .then(tx => {
            console.log("tx: ", tx)
        });

    // Pass this as the account param into getQuote() we built out earlier. This will return a JSON object trade order. 
    const swapQuoteJSON = await getQuote(takerAddress);

    //filter quote sources from quoteJson
    let quoteSourcesJson = swapQuoteJSON.sources;
    console.log("quoteSourcesJson:", quoteSourcesJson);

    let quoteStr = 'the best price comes from ';
    for (const i in quoteSourcesJson) {
        //skip 0 proportion source
        if (!quoteSourcesJson[i].name || !quoteSourcesJson[i].proportion || quoteSourcesJson[i].proportion === "0")
            continue;

        // sources[quoteSourcesJson[i].name] = Number(quoteSourcesJson[i].proportion);
        quoteStr += `${Number(quoteSourcesJson[i].proportion) * 100}% ${quoteSourcesJson[i].name} `;
    }
    console.log("quoteStr:", quoteStr);

    //display quoteJson on page
    document.getElementById("quota_sources").innerHTML = quoteStr;

    // Perform the swap
    const receipt = await web3.eth.sendTransaction(swapQuoteJSON);
    console.log("receipt: ", receipt);
}

//------------------------------------------------------------
//---------------Page action start here-----------------------
//------------------------------------------------------------

// Add init() call
init();

// Call the connect function when the login_button is clicked
document.getElementById("login_button").onclick = connect;
// Call the openModal function when click on select token button
document.getElementById("from_token_select").onclick = () => openModal("from_token");
document.getElementById("to_token_select").onclick = () => openModal("to_token");
document.getElementById("modal_close").onclick = closeModal;

//request for price on from_amount blur
document.getElementById("from_amount").onblur = () => getPrice("from_amount");
document.getElementById("to_amount").onblur = () => getPrice("to_amount");

//swap when click swap swap_button
document.getElementById("swap_button").onclick = trySwap;