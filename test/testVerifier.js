const Verifier = artifacts.require("AnonFTVerifier");

contract("Test Verifier", async accounts => {
  var instance;

  before(async () => {
    console.log("In setup");
    instance = await Verifier.new();
  })

  it("should generate correct t", async () => {
    // const instance = await Verifier.deployed();
    const t = await instance.requiredVerifications.call(72, 9);
    assert.equal(t, 8);
  });

  it("should generate correct t with imperfect values", async () => {
    // const instance = await Verifier.deployed();
    const t = await instance.requiredVerifications.call(70, 9);
    assert.equal(t, 8);
  });
  
  it("should generate random boolean string", async () => {
    // const instance = await Verifier.deployed();
    const bools = await instance.generateRandomBools.call();
    console.log(bools);
  });

  it("should return modulo of negative number", async () => {
    // const instance = await Verifier.deployed();
    const ret = await instance.signedMod.call(-10, 8);
    assert.equal(ret.toNumber(), 6);
  });

  it("should verify information correctly", async () => {
    // const instance = await Verifier.deployed();
    const ids = "[19616,-22520,1005,10883,-15203,3822,5273,-5088,26827,-18602,29302,-20168]";
    const jsonified = JSON.parse(ids);
    const ret = await instance.verify.call(
        11004,
        2429,
        31861,
        12,
        jsonified,
        '0x0000000000000000000000000000000000000000000000000000000000000612'
    );
    assert.equal(ret, true);
  });

  it("should verify information correctly, alternative values", async () => {
    // const instance = await Verifier.deployed();
    const ids = "[1,23896,28321,5974,11470,30976,26009,17424]";
    const jsonified = JSON.parse(ids);
    const ret = await instance.verify.call(
        361,
        25536,
        31861,
        8,
        jsonified,
        '0x00000000000000000000000000000000000000000000000000000000629f5ecf'
    );
    assert.equal(ret, true);
  });

  it("should verify information correctly, alternative values pt. 2", async () => {
    // const instance = await Verifier.deployed();
    const ids = "[1,23896,28321,5974,11470,30976,26009,17424]";
    const jsonified = JSON.parse(ids);
    const ret = await instance.verify.call(
        9,
        210,
        31861,
        8,
        jsonified,
        '0x00000000000000000000000000000000000000000000000000000000629f6653'
    );
    assert.equal(ret, true);
  });

  it("should verify information correctly with negative value", async () => {
    // const instance = await Verifier.deployed();
    const ids = "[19616,-22520,1005,10883,-15203,3822,5273,-5088,26827,-18602,29302,-20168]";
    const jsonified = JSON.parse(ids);
    const ret = await instance.verify.call(
        7175,
        4115,
        31861,
        12,
        jsonified,
        '0x0000000000000000000000000000000000000000000000000000000000000c5f'
    );
    assert.equal(ret, true);
  });

  it("should reject verification correctly", async () => {
    // const instance = await Verifier.deployed();
    const ids = "[19616,-22520,1005,10883,-15203,3822,5273,-5088,26827,-18602,29302,-20168]";
    const jsonified = JSON.parse(ids);
    const ret = await instance.verify.call(
        7175,
        4116,
        31861,
        12,
        jsonified,
        '0x0000000000000000000000000000000000000000000000000000000000000c5f'
    );
    assert.equal(ret, false);
  });
});
