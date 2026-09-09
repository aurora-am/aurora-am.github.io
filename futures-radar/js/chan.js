// chan.js  纯前端缠论引擎
// 输入：K线数组 [{t,o,h,l,c,v}, ...]
// 输出：包含分型/笔/段/中枢/买卖点的对象
// 参考: 缠中说禅《教你炒股票》系列课

(function(global){
"use strict";

function toK(k){return {t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5]};}

// ---------- 1. K线包含处理 → 严格方向序列 ----------
// 返回值是"处理后"的方向序列（实际方向可能更高一级别，含多个原始K）
// 每项 {dir:'up'|'down', peak:{o,h,l,c,t,orig:[idx,...]}, start, end}
function mergeInclude(klines){
    if(klines.length<3) return [];
    const merged=[];
    // 处理第一根
    let last={o:klines[0].o, h:klines[0].h, l:klines[0].l, c:klines[0].c, t:klines[0].t, orig:[0]};
    merged.push({dir:null, k:last}); // 方向未定
    for(let i=1;i<klines.length;i++){
        const k=klines[i];
        const prev=merged[merged.length-1];
        const prev2=merged[merged.length-2];
        // 比较方向：当前与上一根K的相对关系
        // 包含关系：当前K 完全在 上一根K之内
        const contain = (prev.k.h>=k.h && prev.k.l<=k.l) || (k.h>=prev.k.h && k.l<=prev.k.l);
        if(contain){
            // 合并：方向根据前后两根判断
            let merged_dir;
            if(prev2){
                // 上一根方向已定
                if(prev2.dir==='up'){
                    // 高高+低低 推进；低低反向
                    if(k.h>prev.k.h) merged_dir='up';
                    else if(k.l<prev.k.l){
                        // 反向下破后再包，可能反向
                        merged_dir=null;
                    }
                } else if(prev2.dir==='down'){
                    if(k.l<prev.k.l) merged_dir='down';
                    else if(k.h>prev.k.h) merged_dir=null;
                }
            }
            if(prev.dir==null){
                // 第一根方向未定，根据当前与前一根比较
                if(k.h>prev.k.h) prev.dir='up';
                else if(k.l<prev.k.l) prev.dir='down';
                else prev.dir='up';
                merged_dir = prev.dir;
            }
            // 合并高低点
            prev.k.h = Math.max(prev.k.h, k.h);
            prev.k.l = Math.min(prev.k.l, k.l);
            prev.k.t = k.t;
            prev.k.orig.push(i);
            if(merged_dir){ prev.dir = merged_dir; prev.k.dir = merged_dir; }
            else delete prev.dir;
        } else {
            // 不包含 → 新方向
            let newDir = prev.dir;
            if(prev.dir==null){
                if(k.h>prev.k.h) newDir='up';
                else newDir='down';
            }
            const next = {dir:newDir, k:{o:k.o, h:k.h, l:k.l, c:k.c, t:k.t, orig:[i], dir:newDir}};
            merged.push(next);
        }
    }
    // 过滤掉方向为null的（首根）
    return merged.filter(m=>m.dir).map(m=>({dir:m.dir, k:m.k}));
}

// ---------- 2. 找顶底分型 ----------
function findFractals(merged){
    // merged 数组，索引 1..len-2 才可能是分型
    const tops=[], bots=[];
    for(let i=1;i<merged.length-1;i++){
        const p=merged[i-1].k, c=merged[i].k, n=merged[i+1].k;
        // 顶分型：高点最高，低点最低
        if(c.h>p.h && c.h>n.h && c.l>p.l && c.l>n.l) tops.push({idx:i, t:c.t, price:c.h, dir:-1});
        if(c.l<p.l && c.l<n.l && c.h<p.h && c.h<n.h) bots.push({idx:i, t:c.t, price:c.l, dir:1});
    }
    return {tops, bots, all:[...tops, ...bots].sort((a,b)=>a.idx-b.idx)};
}

// ---------- 3. 划笔（顶-底-顶 ≥5根K） ----------
function strokes(fx, merged, klines, minBars=5){
    if(!fx.all.length) return [];
    const sorted = fx.all.slice().sort((a,b)=>a.idx-b.idx);
    const strokes_=[];
    let prev = sorted[0];
    for(let i=1;i<sorted.length;i++){
        const cur = sorted[i];
        // 顶→底 或 底→顶（不交替则合并一笔但更高一级别）
        if(prev.dir===cur.dir) continue; // 同向，跳过
        // 起止原始K线索引
        const startOrig = prev.k===undefined? prev.idx : merged[prev.idx].k.orig[0];
        const endOrig = merged[cur.idx].k.orig[merged[cur.idx].k.orig.length-1];
        const barCount = endOrig - startOrig + 1;
        if(barCount<minBars){
            // 笔内部不够，继续
            continue;
        }
        strokes_.push({
            dir: prev.dir===-1?-1:1, // -1=向下,1=向上
            startIdx: startOrig, endIdx: endOrig,
            fromP: prev.dir===-1? merged[prev.idx].k.h : merged[prev.idx].k.l,
            toP:  cur.dir===-1? merged[cur.idx].k.h : merged[cur.idx].k.l,
            startT: prev.t, endT: cur.t,
            startOrig, endOrig
        });
        prev = cur;
    }
    return strokes_;
}

// ---------- 4. 划段（至少3笔构成段） ----------
function segments(strokesArr){
    if(strokesArr.length<3) return {segs:[], valid:[]};
    const segs=[];
    let cur = strokesArr[0]; // 当前段起点（一笔）
    let inDir = strokesArr[0].dir;
    for(let i=1;i<strokesArr.length;i++){
        const s = strokesArr[i];
        // 当前笔走向
        if(s.dir===inDir){
            // 同向，可能起新段或扩展当前
            continue;
        }
        // 反向：检验是否已有3笔
        const len = strokesArr.indexOf(s) - strokesArr.indexOf(cur) + 1;
        if(len>=3){
            segs.push({
                dir: inDir,
                startOrig: cur.startOrig, endOrig: s.startOrig,
                fromP: cur.fromP, toP: s.fromP,
                startT: cur.startT, endT: s.endT
            });
            cur = strokesArr[i]; // 可能起新段的第一笔
            inDir = s.dir;
        }
    }
    return {segs, valid:segs.length>=1};
}

// ---------- 5. 找中枢 ----------
// 中枢定义：连续三段（或更多）有重叠区间 [max(下沿), min(上沿)]
function pivots(segs){
    if(segs.length<3) return [];
    const pivs=[];
    let ws = 0;
    for(let i=2;i<segs.length;i++){
        const s0=segs[i-2], s1=segs[i-1], s2=segs[i];
        // 三段必须：s0 向上， s1 向下/向上/向下，s2 整体方向分歧——标准中枢需至少3段且方向交替
        // 简化：取三段的高低区间重叠
        const highs=[s0.toP, s1.toP, s2.toP];
        const lows =[s0.fromP, s1.fromP, s2.fromP];
        const zg = Math.min(...highs);
        const zd = Math.max(...lows);
        if(zg<=zd) continue;
        pivs.push({
            startOrig: s0.startOrig, endOrig: s2.endOrig,
            zg, zd, gg:Math.max(...highs), dd:Math.min(...lows),
            segs:[s0,s1,s2]
        });
    }
    return pivs;
}

// ---------- 6. 买卖点（依赖中枢+pivots） ----------
function buySellPoints(segs, pivs, strokesArr, klines, merged){
    // 一买：下跌段背驰后第一次反弹（最后一段向下力度 < 前一段向下）
    // 一卖：上涨段背驰后第一次回落
    // 二买：一买后回踩不破一买低点
    // 二卖：一卖后反弹不破一卖高点
    // 三买：向上离开中枢后回踩不进中枢
    // 三卖：向下离开中枢后反弹不进中枢
    const pts=[];
    if(pivs.length===0 && segs.length===0){
        // 没有中枢和段，至少给"无信号"
        return pts;
    }
    // ---- 三买/三卖（基于中枢最稳定）----
    for(let i=0;i<pivs.length;i++){
        const p=pivs[i];
        const before=p.segs[0], inside=p.segs[1], after=p.segs[2];
        // 段 before/after 与中枢方向相反，inside 起连接作用
        if(before.dir===1){
            // 上涨上探 gg，回调，张 third 段上行，再次回调：(简化判断) after 段走出中枢后回踩不进中枢
            // 简化：after.toP > zg && after.toP 不在 near zg，且后续没新段破位 -> 三买候选
            const nextBreak = (pivs[i+1] && pivs[i+1].segs[1].fromP < p.zd);
            if(after.toP>=p.zg && !nextBreak){
                pts.push({type:'T3', idx: after.endOrig, t: after.endT, price: after.toP,
                    dir:1, reason:`三买·离开中枢${p.zg}不破${p.zd}`});
            }
        }
    }
    // ---- 一买/一卖：用最后两段比力度（背驰） ----
    if(segs.length>=2){
        const last=segs[segs.length-1], prev=segs[segs.length-2];
        if(last.dir===-1){
            // 下跌末端
            // 简单背驰 = 最后一段幅度小于前一段
            if(prev.dir===-1){ // 两段都向下
                const amp1=prev.fromP-prev.toP, amp2=last.fromP-last.toP;
                if(amp2<amp1*0.8){
                    pts.push({type:'T1', idx:last.endOrig, t:last.endT, price:last.toP,
                        dir:1, reason:`一买·下跌背驰(amp${amp2.toFixed(0)}/${amp1.toFixed(0)})`});
                }
            }else if(prev.dir===1){
                // 上涨后下跌背驰 → 一卖前的可能（这里不标，按走势需要时标）
            }
        }else if(last.dir===1){
            // 上涨末端
            if(prev.dir===1){
                const amp1=prev.toP-prev.fromP, amp2=last.toP-last.fromP;
                if(amp2<amp1*0.8){
                    pts.push({type:'T1', idx:last.endOrig, t:last.endT, price:last.toP,
                        dir:-1, reason:`一卖·上涨背驰`});
                }
            }
        }
    }
    // ---- 二买/二卖（简化：用最近一笔+前一个分型） ----
    if(pts.length===0 && strokesArr.length>=2){
        const a=strokesArr[strokesArr.length-2], b=strokesArr[strokesArr.length-1];
        if(a.dir===1 && b.dir===1 && b.toP<a.toP){
            // 最近一笔上涨，未破前高 → 二买雏形
            pts.push({type:'T2', idx:b.endOrig, t:b.endT, price:b.toP, dir:1,
                reason:`二买·回踩未破${a.toP.toFixed(0)}`});
        }
        if(a.dir===-1 && b.dir===-1 && b.toP>a.toP){
            pts.push({type:'T2', idx:b.endOrig, t:b.endT, price:b.toP, dir:-1,
                reason:`二卖·反弹未破${a.toP.toFixed(0)}`});
        }
    }
    return pts;
}

// ---------- 7. MACD 指标 ----------
function macd(klines, fast=12, slow=26, signal=9){
    const emaF=[], emaS=[], dif=[], dea=[], macdHist=[];
    let f=null, s=null;
    for(let i=0;i<klines.length;i++){
        const c=klines[i].c;
        if(i===0){ f=c; s=c; }
        else {
            f = c*2/(fast+1) + f*(fast-1)/(fast+1);
            s = c*2/(slow+1) + s*(slow-1)/(slow+1);
        }
        const d = f - s;
        const prevDea = i===0 ? d : (dea[i-1]*2/(signal+1) + dif[i-1]*(signal-1)/(signal+1));
        dif.push(d);
        dea.push(prevDea);
        macdHist.push((d - prevDea)*2);
    }
    return {dif, dea, hist:macdHist};
}

// ---------- 8. 主入口 ----------
function analyze(klines, opts={}){
    if(!Array.isArray(klines) || klines.length<10) return {ok:false, msg:'K线过少'};
    const merged = mergeInclude(klines);
    if(merged.length<4) return {ok:false, msg:'合并后序列过短'};
    const fx = findFractals(merged);
    const minBar = opts.minBar ?? 5;
    const sArr = strokes(fx, merged, klines, minBar);
    const segData = segments(sArr);
    const pivs = pivots(segData.segs);
    const pts = buySellPoints(segData.segs, pivs, sArr, klines, merged);
    const m = macd(klines);
    // 当前方向（最近一段）
    let trend='震荡';
    if(segData.segs.length){
        const last=segData.segs[segData.segs.length-1];
        trend = last.dir===1 ? '多头' : '空头';
    }
    return {
        ok:true,
        trend, merged, fractals:fx,
        strokes:sArr, segments:segData.segs, pivots:pivs,
        points:pts, macd:m,
        lastFx: fx.all.length? fx.all[fx.all.length-1] : null
    };
}

global.Chan = {mergeInclude, findFractals, strokes, segments, pivots, buySellPoints, macd, analyze, toK};
})(typeof window!=='undefined'? window : globalThis);
