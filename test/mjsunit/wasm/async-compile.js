// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

load("test/mjsunit/wasm/wasm-module-builder.js");

async function assertCompiles(buffer) {
  var module = await WebAssembly.compile(buffer);
  assertInstanceof(module, WebAssembly.Module);
}

function assertCompileError(buffer, msg) {
  assertEquals('string', typeof msg);
  msg = 'WebAssembly.compile(): ' + msg;
  function checkException(e) {
    if (!(e instanceof WebAssembly.CompileError)) throw e;
    assertEquals(msg, e.message, 'Error message');
  }
  return assertPromiseResult(
      WebAssembly.compile(buffer), assertUnreachable, checkException);
}

assertPromiseResult(async function basicCompile() {
  let ok_buffer = (() => {
    var builder = new WasmModuleBuilder();
    builder.addFunction('f', kSig_i_v)
        .addBody([kExprI32Const, 42])
        .exportAs('f');
    return builder.toBuffer();
  })();

  // The OK buffer validates and can be made into a module.
  assertTrue(WebAssembly.validate(ok_buffer));
  let ok_module = new WebAssembly.Module(ok_buffer);
  assertTrue(ok_module instanceof WebAssembly.Module);

  // The bad buffer does not validate and cannot be made into a module.
  let bad_buffer = new ArrayBuffer(0);
  assertFalse(WebAssembly.validate(bad_buffer));
  assertThrows(
      () => new WebAssembly.Module(bad_buffer), WebAssembly.CompileError);

  let kNumCompiles = 3;

  // Three compilations of the OK module should succeed.
  for (var i = 0; i < kNumCompiles; i++) {
    await assertCompiles(ok_buffer);
  }

  // Three compilations of the bad module should fail.
  for (var i = 0; i < kNumCompiles; i++) {
    await assertCompileError(bad_buffer, 'BufferSource argument is empty');
  }
}());

assertPromiseResult(async function badFunctionInTheMiddle() {
  // We had an error where an exception was generated by a background task and
  // later thrown in a foreground task. The handle to the exception died
  // between, since the HandleScope was left.
  // This test reproduced that error.
  let builder = new WasmModuleBuilder();
  let sig = builder.addType(kSig_i_v);
  for (var i = 0; i < 10; ++i) {
    builder.addFunction('a' + i, sig).addBody([kExprI32Const, 42]);
  }
  builder.addFunction('bad', sig).addBody([]);
  for (var i = 0; i < 10; ++i) {
    builder.addFunction('b' + i, sig).addBody([kExprI32Const, 42]);
  }
  let buffer = builder.toBuffer();
  await assertCompileError(
      buffer,
      'Compiling wasm function \"bad\" failed: ' +
          'expected 1 elements on the stack for fallthru to @1, found 0 @+94');
}());

assertPromiseResult(async function importWithoutCode() {
  // Regression test for https://crbug.com/898310.
  let builder = new WasmModuleBuilder();
  builder.addImport('m', 'q', kSig_i_i);
  await builder.asyncInstantiate({'m': {'q': i => i}});
}());
