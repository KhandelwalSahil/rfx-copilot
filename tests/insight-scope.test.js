import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {comparison,evaluationExclusions} from '../src/domain.js';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const scopeSource=source.slice(source.indexOf('function comparisonScope(){'),source.indexOf('function supplierOverview('));
const answerSource=source.slice(source.indexOf('function answerViewChanged('),source.indexOf('function answerEvidence('));
const rfx=JSON.parse(fs.readFileSync(new URL('../dataset/rfx.json',import.meta.url)));
function setup(r){const ctx=vm.createContext({state:{rfx:r,data:{}},qualityFilter:true,commonFilter:false,comparison,evaluationExclusions});vm.runInContext(scopeSource+answerSource,ctx);return ctx;}
test('opening insights with no requested items returns an empty scope instead of crashing',()=>{const ctx=setup({...rfx,lines:[]});assert.equal(vm.runInContext('comparisonScope().lineIds.length',ctx),0);ctx.commonFilter=true;assert.equal(vm.runInContext('comparisonScope().lineIds.length',ctx),0);});
test('chat identifies answers for a previous filtered view without declaring unchanged source data stale',()=>{const ctx=setup(rfx);vm.runInContext('message={scope:comparisonScope()}',ctx);assert.equal(vm.runInContext('answerViewChanged(message)',ctx),false);ctx.qualityFilter=false;assert.equal(vm.runInContext('answerViewChanged(message)',ctx),true);ctx.qualityFilter=true;ctx.commonFilter=true;assert.equal(vm.runInContext('answerViewChanged(message)',ctx),true);});
