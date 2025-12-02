// database.js
const productDatabase = [
    // --- SILGAN ---
    { "cod": 3, "client": "SILGAN", "name": "ROSCA BAIXA P2000 28 400 ESTRIADA BRANCO 767", "cavities": 46, "cycle": 33, "weight": 2.09, "pieces_per_hour_goal": 5018, "mp": "" },
    { "cod": 4, "client": "SILGAN", "name": "ROSCA BAIXA P2000 28 400 ESTRIADA OURO CB101", "cavities": 46, "cycle": 33, "weight": 2.09, "pieces_per_hour_goal": 5018, "mp": "" },
    { "cod": 6, "client": "SILGAN", "name": "ROSCA ALTA P2000 28 410 FOSCA BRANCA CB124 PP", "cavities": 23, "cycle": 21.15, "weight": 2.09, "pieces_per_hour_goal": 3915, "mp": "" },
    { "cod": 7, "client": "SILGAN", "name": "ROSCA ALTA P2000 28 410 FOSCA BRANCA 767 PP", "cavities": 23, "cycle": 21.15, "weight": 2.09, "pieces_per_hour_goal": 3915, "mp": "" },
    { "cod": 12, "client": "SILGAN", "name": "ROSCA ALTA P2000 28 410 ESTRIADA NATURAL PP", "cavities": 23, "cycle": 21.15, "weight": 2.09, "pieces_per_hour_goal": 3915, "mp": "" },
    { "cod": 15, "client": "SILGAN", "name": "ROSCA ALTA P2000 28 410 FOSCA AZUL CB150 PP", "cavities": 23, "cycle": 21.15, "weight": 2.09, "pieces_per_hour_goal": 3915, "mp": "" },
    { "cod": 17, "client": "SILGAN", "name": "ROSCA ALTA P2000 28 410 FOSCA PRETO 017 PP", "cavities": 23, "cycle": 21.15, "weight": 2.09, "pieces_per_hour_goal": 3915, "mp": "" },
    { "cod": 24, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD NATURAL PP BRILHANTE", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 25, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD OURO CB101 PP BRILHANTE", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 31, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD AZUL CB150 PP TEXT", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 32, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD BRANCO 767 PP TEXT", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 33, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD BRANCO CB124 PP TEXT", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 37, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD OURO CB149 PP TEXT", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 39, "client": "SILGAN", "name": "ANEL TRAVA P2000 STD PRETO 17 PP TEXT", "cavities": 16, "cycle": 13.4, "weight": 0.85, "pieces_per_hour_goal": 4299, "mp": "" },
    { "cod": 69, "client": "SILGAN", "name": "ATUADOR P2000 SATIN AZUL CB150 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 70, "client": "SILGAN", "name": "ATUADOR P2000 SATIN BRANCO 767 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 71, "client": "SILGAN", "name": "ATUADOR P2000 SATIN BRANCO CB124 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 75, "client": "SILGAN", "name": "ATUADOR P2000 SATIN NATURAL PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 77, "client": "SILGAN", "name": "ATUADOR P2000 SATIN OURO CB101 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 78, "client": "SILGAN", "name": "ATUADOR P2000 SATIN OURO CB149 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 80, "client": "SILGAN", "name": "ATUADOR P2000 SATIN PRETO 17 PP", "cavities": 23, "cycle": 19, "weight": 1.45, "pieces_per_hour_goal": 4358, "mp": "" },
    { "cod": 91, "client": "SILGAN", "name": "BUCHA P2000 2ML NATURAL PP", "cavities": 29, "cycle": 16, "weight": 0.55, "pieces_per_hour_goal": 6525, "mp": "" },
    { "cod": 92, "client": "SILGAN", "name": "ACUMULADOR P2000 28MM NAT PP EF045", "cavities": 32, "cycle": 19, "weight": 1.25, "pieces_per_hour_goal": 6063, "mp": "" },
    { "cod": 93, "client": "SILGAN", "name": "ACUMULADOR P2000 JUNTA-A NATURAL EF045", "cavities": 32, "cycle": 19, "weight": 1.25, "pieces_per_hour_goal": 6063, "mp": "" },
    { "cod": 94, "client": "SILGAN", "name": "TAMPA MKIV MD STD NATURAL PP PD06001", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 97, "client": "SILGAN", "name": "RETENTOR MKIV MD M300 STD NAT POM DF002 - 24 CAVS", "cavities": 23, "cycle": 15.5, "weight": 0.68, "pieces_per_hour_goal": 5342, "mp": "" },
    { "cod": 102, "client": "SILGAN", "name": "ATUADOR MKIV STD AZUL CB72 PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 103, "client": "SILGAN", "name": "ATUADOR MKIV STD BRANCO 767 PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 104, "client": "SILGAN", "name": "ATUADOR MKIV STD BRANCO ANIL 2902 PP 012PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 109, "client": "SILGAN", "name": "ATUADOR MKIV STD NATURAL PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 111, "client": "SILGAN", "name": "ATUADOR MKIV STD PRETO 17 PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 112, "client": "SILGAN", "name": "ATUADOR MKIV STD ROSA CB79 PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 114, "client": "SILGAN", "name": "ATUADOR MKIV STD ROXO CB144 PP 01PD06002", "cavities": 30, "cycle": 30.2, "weight": 1.85, "pieces_per_hour_goal": 3576, "mp": "" },
    { "cod": 120, "client": "SILGAN", "name": "ATUADOR MD STD BRANCO 767 PE", "cavities": 30, "cycle": 30.4, "weight": 1.92, "pieces_per_hour_goal": 3553, "mp": "" },
    { "cod": 124, "client": "SILGAN", "name": "ATUADOR MD STD NATURAL PE 01PD06003", "cavities": 30, "cycle": 30.4, "weight": 1.92, "pieces_per_hour_goal": 3553, "mp": "" },
    { "cod": 125, "client": "SILGAN", "name": "ATUADOR MD STD PRETO 01PD06003", "cavities": 30, "cycle": 30.4, "weight": 1.92, "pieces_per_hour_goal": 3553, "mp": "" },
    { "cod": 126, "client": "SILGAN", "name": "ATUADOR MD STD OURO CB112 PE 01PD06003", "cavities": 30, "cycle": 30.4, "weight": 1.92, "pieces_per_hour_goal": 3553, "mp": "" },
    { "cod": 140, "client": "SILGAN", "name": "ROSCA MKIV MD 20 410 ESTRIADA BRANCO 767 PP 05PD06007", "cavities": 44, "cycle": 40, "weight": 2.35, "pieces_per_hour_goal": 3960, "mp": "" },
    { "cod": 146, "client": "SILGAN", "name": "ROSCA MKIV MD 20 410 LISA BRANCA 767 PP 06PD06007", "cavities": 44, "cycle": 40, "weight": 2.35, "pieces_per_hour_goal": 3960, "mp": "" },
    { "cod": 150, "client": "SILGAN", "name": "ROSCA MKIV MD 20 410 LISA PRETO PP 06PD06007", "cavities": 44, "cycle": 40, "weight": 2.35, "pieces_per_hour_goal": 3960, "mp": "" },
    { "cod": 161, "client": "SILGAN", "name": "ROSCA MKIV MD 24 410 ESTRIADA BRANCO 767 PP 13PD06007", "cavities": 44, "cycle": 40, "weight": 2.35, "pieces_per_hour_goal": 3960, "mp": "" },
    { "cod": 175, "client": "SILGAN", "name": "RETENTOR M300 STD NAT POM DF002 - 64 CAVIDADES", "cavities": 56, "cycle": 20.5, "weight": 0.45, "pieces_per_hour_goal": 9834, "mp": "" },
    { "cod": 176, "client": "SILGAN", "name": "ACUMULADOR M300 STANDARD NAT PP DG007", "cavities": 46, "cycle": 25, "weight": 1.08, "pieces_per_hour_goal": 6624, "mp": "" },
    { "cod": 206, "client": "SILGAN", "name": "CAPSULA MELODIE CLIKIT 17 NAT PP DP054", "cavities": 15, "cycle": 16, "weight": 1.25, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 207, "client": "SILGAN", "name": "CAPSULA MELODIE CLIKIT 18 NAT PP DPB056", "cavities": 15, "cycle": 16, "weight": 1.25, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 2563, "client": "SILGAN", "name": "ROSCA BAIXA P2000 28 400 ESTRIADA NATURAL DPB064", "cavities": 46, "cycle": 33, "weight": 2.09, "pieces_per_hour_goal": 5018, "mp": "" },
    { "cod": 1063, "client": "SILGAN", "name": "ROSCA M300 GL18 ESTRIADO NATURAL PP DPB072", "cavities": 29, "cycle": 33, "weight": 2.35, "pieces_per_hour_goal": 3164, "mp": "" },
    { "cod": 1623, "client": "SILGAN", "name": "TAMPA MKIV MD STD PRETA PP PD060", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 3204, "client": "SILGAN", "name": "TAMPA MKIV MD BRONZE CB245 PP PD060", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 4485, "client": "SILGAN", "name": "TAMPA MKIV MD STD BRANCA CB263 PP PD060", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 4505, "client": "SILGAN", "name": "TAMPA MKIV MD STD FUME CB280 PP PD060", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 4669, "client": "SILGAN", "name": "TAMPA MKIV MD STD BEGE CB286 PP PD060", "cavities": 14, "cycle": 10.5, "weight": 0.95, "pieces_per_hour_goal": 4800, "mp": "" },

        // NOVO PRODUTO SILGAN
        { "cod": 4596, "client": "SILGAN", "name": "ROSCA MKIV MD 22 415 ESTRIADA PRETO 017 PP 09PD06007 - 1.01.01.005.128", "cavities": 44, "cycle": 40, "weight": 2.35, "pieces_per_hour_goal": 3366, "mp": "" },

    // --- APTAR ---
    { "cod": 226, "client": "APTAR", "name": "FIXACAO-GS-28/410CUST-28--THREAD-HDPE-WH", "cavities": 22, "cycle": 36, "weight": 1.65, "pieces_per_hour_goal": 2200, "mp": "" },
    { "cod": 4268, "client": "APTAR", "name": "FIXAÇÃO-GS-28/410CUST-28--THREAD-HDPE-NATURAL-", "cavities": 22, "cycle": 36, "weight": 14.95, "pieces_per_hour_goal": 2200, "mp": "" },
    { "cod": 4324, "client": "APTAR", "name": "FIXAÇÃO-GS-24/410--2N-THREAD-PP-YELL (LISO)", "cavities": 16, "cycle": 18, "weight": 1.25, "pieces_per_hour_goal": 4800, "mp": "" },
    { "cod": 436, "client": "APTAR", "name": "CLIP PLASTICO PP-RND DS25 K2/F3 OURO (MODIF)", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 441, "client": "APTAR", "name": "CLIP PLASTICO PP-RND MA00 K2/F3 PRETO (MODIF)", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 442, "client": "APTAR", "name": "CCLIPE-K--PP-NATU--RRNA00004", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 452, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-NATU---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 453, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLAC---SPRAY--MS06", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 454, "client": "APTAR", "name": "ATUADOR - EMII-PP--4,34-BLUE---SPRAY--KS24", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 455, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GREE---SPRAY-GS18", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 456, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BROW---SPRAY--HS11", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 457, "client": "APTAR", "name": "TAMPA-EM-28,20-PP-NATU--SHNY-----EM STD", "cavities": 29, "cycle": 12, "weight": 0.95, "pieces_per_hour_goal": 8700, "mp": "" },
    { "cod": 458, "client": "APTAR", "name": "TAMPA-EM-28,20-PP-BLAC--SHNY", "cavities": 29, "cycle": 12, "weight": 0.95, "pieces_per_hour_goal": 8700, "mp": "" },
    { "cod": 459, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN-SHNY--SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 464, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-WHIT---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 477, "client": "APTAR", "name": "CLIP PLASTICO BRANCO CA01 K2/F3", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 478, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PINK---SPRAY--ES30", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 534, "client": "APTAR", "name": "ACT EM CLASSIC PP MINT GREEN 1702395-SE", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 905, "client": "APTAR", "name": "CLIP PLASTICO PP-RND DS10 K2/F3 DOURADO (MODIF)", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 921, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-RED---SPRAY--ES38", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 936, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-RED-SHNY--SPRAY-A3", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5880, "client": "APTAR", "name": "TAMPA-EM-28,20-PP-GREE--SHNY----HERBAL", "cavities": 29, "cycle": 12, "weight": 0.95, "pieces_per_hour_goal": 8700, "mp": "" },
    { "cod": 948, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY--29025909", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 1005, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-YELL---SPRAY--DS22", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 1177, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY--293C", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 1179, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY-LMPP", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 1601, "client": "APTAR", "name": "CLIPE-K-GS-PP-SILV--MB21--17,45", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 1731, "client": "APTAR", "name": "ATUADOR-EMII-PP—4,34- GREY---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 1925, "client": "APTAR", "name": "ATUADOR-EMII-PP-GOLD---SPRAY--DS24", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2181, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-SILV---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2231, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-YELL---SPRAY--DS27", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2232, "client": "APTAR", "name": "CLIPE-K-GS-PP-RED---17,45", "cavities": 15, "cycle": 16, "weight": 0.45, "pieces_per_hour_goal": 3375, "mp": "" },
    { "cod": 2291, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-RED---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2561, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GOLD---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2574, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2666, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PINK---SPRAY—2405", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2701, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY--KS17", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2707, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-WHIT---SPRAY--CS03", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2710, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GOLD---SPRAY--PPG1", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 2957, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN---SPRAY----PR", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 3510, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY----MO", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 3570, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GOLD---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 3586, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN---SPRAY----MO", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 3870, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34---SPRAY-BLACK", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 3956, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-LILA---SPRAY----CL", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 4091, "client": "APTAR", "name": "CLIP-Q--PP-NATU-XX04", "cavities": 8, "cycle": 17, "weight": 0.65, "pieces_per_hour_goal": 1694, "mp": "" },
    { "cod": 4143, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-WINE---LOT-ES4", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4160, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-NATU---LOT-XX0", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4161, "client": "APTAR", "name": "ATUADOR-POEMA-PP--5,75-NATU---LOT-XX04", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4253, "client": "APTAR", "name": "ATUADOR-POEMA-PP--5,75-WINE---LOT-ES44", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4498, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,85-ORAN---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4509, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-PINK---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4688, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,85-YELL---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4689, "client": "APTAR", "name": "ATUADOR-POEMA-PP--5,85-YELL---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 4691, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN---SPRAY----EU", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 4693, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY----CL", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5026, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PINK---SPRAY----TO", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5083, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-LILA---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 5302, "client": "APTAR", "name": "ATUADOR-K2-PP---NATU-----RRNA00004", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5313, "client": "APTAR", "name": "ATUADOR-A03LV1-PP---NATU-----RRNA00003", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5328, "client": "APTAR", "name": "ATUADOR-A46V1-PP---NATU-----RRNA00003", "cavities": 32, "cycle": 21, "weight": 0.194, "pieces_per_hour_goal": 5486, "mp": "" },
    { "cod": 5332, "client": "APTAR", "name": "ACTU-A03LV1-PP---GREY-SHNY------P228", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5382, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GOLD---SPRAY-13017", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5412, "client": "APTAR", "name": "ACTU-K2-PP---BLUE-------P322", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5414, "client": "APTAR", "name": "ACTU-K2-PP---TURQ-------P287", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5416, "client": "APTAR", "name": "ACTU-K2-PP---BLUE-------P223", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5419, "client": "APTAR", "name": "ACTU-A03LV1-PP---BROW-SHNY------P18", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5463, "client": "APTAR", "name": "ACTU-A03LV1-PP---GOLD-SHNY", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5537, "client": "APTAR", "name": "ATUADOR-A03LV1-PP---BLAC----MA00", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5647, "client": "APTAR", "name": "ATUADOR-K2-PP---WHIT-----RWH000002", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5684, "client": "APTAR", "name": "ATUADOR-A03LV1-PP---BLUE-SHNY------329", "cavities": 56, "cycle": 18, "weight": 0.85, "pieces_per_hour_goal": 11200, "mp": "" },
    { "cod": 5709, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PURP---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5710, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-BROW---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 5729, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GOLD---SPRAY", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5741, "client": "APTAR", "name": "ATUADOR-K2-PP---BLAC-----RBK000001", "cavities": 16, "cycle": 19.2, "weight": 1.45, "pieces_per_hour_goal": 3000, "mp": "" },
    { "cod": 5858, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-RED---SPRAY--36423", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5859, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN---SPRAY----KA", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5860, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-BLUE---SPRAY----KA", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5879, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-GREE---SPRAY----HE", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 5999, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PURP---SPRAY--SD 2", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 6005, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-ORAN---SPRAY--2459", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 6095, "client": "APTAR", "name": "ATUADOR-POEMA-PP--5,85-RED---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 6097, "client": "APTAR", "name": "ATUADOR-SENTIDOS-PP--5,75-RED---LOT", "cavities": 22, "cycle": 25.5, "weight": 2.15, "pieces_per_hour_goal": 3106, "mp": "" },
    { "cod": 6140, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-LILA---SPRAY----CA", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },
    { "cod": 6141, "client": "APTAR", "name": "TAMPA-EM-28,20-PP-PINK--SHNY-----TODODIA", "cavities": 29, "cycle": 12, "weight": 0.95, "pieces_per_hour_goal": 8700, "mp": "" },
    { "cod": 6142, "client": "APTAR", "name": "ATUADOR-EMII-PP--4,34-PINK---SPRAY----TO", "cavities": 30, "cycle": 20, "weight": 1.85, "pieces_per_hour_goal": 5400, "mp": "" },

    // --- ÓRICA ---
    { "cod": 236, "client": "ÓRICA", "name": "J-HOOK LONG BLUE (CLIP AZUL)", "cavities": 6, "cycle": 18, "weight": 0.35, "pieces_per_hour_goal": 1200, "mp": "" },
    { "cod": 237, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ YELLOW 17MS (CONECT. AMARELO)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 238, "client": "ÓRICA", "name": "CORPO PLAST EXEL MS/DCD (COR AZUL 65 MS)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 239, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ WHITE 42MS (CONECT. BRANCO)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 240, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ MSC ORANGE 100MS (CONECT. LARANJA)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 242, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ GREEN 9MS (CONECT. VERDE)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 243, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ RED 25MS (CONECT. VERMELHO)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3582, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ LIGHTGREEN 200MS (CONECT. VERDE CLARO)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3939, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ YELLOW 17MS (CONECT. AMARELO EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3940, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ WHITE 42MS (CONECT. BRANCO EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3941, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ MSC ORANGE 100MS (CONECT. LARANJA EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3942, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ GREEN 9MS (CONECT. VERDE EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3943, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ RED 25MS (CONECT. VERMELHO EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 3944, "client": "ÓRICA", "name": "SHELL PLASTIC EXEL™ LIGHTGREEN 200MS (CON. VERDE CL. EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 5034, "client": "ÓRICA", "name": "CONECTOR,PLAST,MS-CONNECTOR ROJO - (CONECT. VERMELHO EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 5035, "client": "ÓRICA", "name": "CONECTOR,PLAST,MS-CONNECTOR,AMARILLO - (CONECT. AMAR. EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },
    { "cod": 5082, "client": "ÓRICA", "name": "SHELL;PLASTIC;EXCEL;BLUE;65MS - (CONECT. AZUL EXP.)", "cavities": 4, "cycle": 30, "weight": 0.25, "pieces_per_hour_goal": 480, "mp": "" },

    // --- PARKER ---
    { "cod": 257, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 258, "client": "PARKER", "name": "TAMPA PLASTICA COM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 259, "client": "PARKER", "name": "BOCAL PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 260, "client": "PARKER", "name": "PISTAO PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 261, "client": "PARKER", "name": "TAMPA PLASTICA 5831", "cavities": 4, "cycle": 35, "weight": 0.55, "pieces_per_hour_goal": 411, "mp": "" },
    { "cod": 262, "client": "PARKER", "name": "COROA PARA FILTRO DE OLEO", "cavities": 2, "cycle": 18, "weight": 0.65, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 263, "client": "PARKER", "name": "ADAPTADOR", "cavities": 2, "cycle": 18, "weight": 0.35, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 264, "client": "PARKER", "name": "SUPORTE PLASTICO SERIE 600 ESCAL (COM ABA)", "cavities": 4, "cycle": 50, "weight": 1.25, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 265, "client": "PARKER", "name": "SUPORTE PLASTICO SERIE R260 (SEM ABA)", "cavities": 4, "cycle": 50, "weight": 1.25, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 266, "client": "PARKER", "name": "PLUG 1/4 - 225 PARA FILTRO DE OLEO", "cavities": 1, "cycle": 20, "weight": 0.15, "pieces_per_hour_goal": 180, "mp": "" },
    { "cod": 267, "client": "PARKER", "name": "TAMPA PLASTICA 4 CAVIDADES", "cavities": 4, "cycle": 50, "weight": 0.75, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 268, "client": "PARKER", "name": "TAMPA PLASTICA 5923 - DUPONT", "cavities": 4, "cycle": 40, "weight": 0.65, "pieces_per_hour_goal": 360, "mp": "" },
    { "cod": 277, "client": "PARKER", "name": "CONICO FILTRO OLEO", "cavities": 3, "cycle": 60, "weight": 0.95, "pieces_per_hour_goal": 180, "mp": "" },
    { "cod": 278, "client": "PARKER", "name": "TURBINA (MONTADA) P/ FILTRO DE OLEO", "cavities": 3, "cycle": 60, "weight": 1.05, "pieces_per_hour_goal": 180, "mp": "" },
    { "cod": 3457, "client": "PARKER", "name": "TAMPA PLASTICA 5923 - DURETHAN", "cavities": 4, "cycle": 40, "weight": 0.65, "pieces_per_hour_goal": 360, "mp": "" },
    { "cod": 3503, "client": "PARKER", "name": "TAMPA SUPERIOR PARA FILTRO", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 3504, "client": "PARKER", "name": "TAMPA INFERIOR PARA FILTRO", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 3725, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO (NOVA VERSAO)", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 3817, "client": "PARKER", "name": "TAMPA SUPERIOR PARA FILTRO", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 3818, "client": "PARKER", "name": "TAMPA INFERIOR PARA FILTRO", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 2294, "client": "PARKER", "name": "SUPORTE DO COPO NOVO - 6 CAVIDADES - TECHNYL", "cavities": 6, "cycle": 50, "weight": 54.85, "pieces_per_hour_goal": 432, "mp": "" },
    { "cod": 3983, "client": "PARKER", "name": "TAMPA PLASTICA 5831", "cavities": 4, "cycle": 35, "weight": 0.55, "pieces_per_hour_goal": 411, "mp": "" },
    { "cod": 4010, "client": "PARKER", "name": "SUPORTE PLASTICO SERIE 600 ESCAL (COM ABA) REC", "cavities": 4, "cycle": 50, "weight": 1.25, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 4017, "client": "PARKER", "name": "PISTAO PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 4046, "client": "PARKER", "name": "BOCAL PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 4047, "client": "PARKER", "name": "TAMPA PLASTICA 4 CAVIDADES", "cavities": 4, "cycle": 50, "weight": 0.75, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 4048, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4049, "client": "PARKER", "name": "TAMPA PLASTICA COM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4050, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO (NOVA VERSAO)", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4150, "client": "PARKER", "name": "SUPORTE PLASTICO SERIE 600 ESCAL (COM ABA)", "cavities": 4, "cycle": 50, "weight": 1.25, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 4151, "client": "PARKER", "name": "SUPORTE PLASTICO SERIE R260 (SEM ABA)", "cavities": 4, "cycle": 50, "weight": 1.25, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 4152, "client": "PARKER", "name": "BOCAL PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 4153, "client": "PARKER", "name": "PISTAO PARA FILTRO DE OLEO", "cavities": 4, "cycle": 23, "weight": 0.85, "pieces_per_hour_goal": 626, "mp": "" },
    { "cod": 4154, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO (NOVA VERSAO)", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4155, "client": "PARKER", "name": "TAMPA PLASTICA SEM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4156, "client": "PARKER", "name": "TAMPA PLASTICA COM FURO", "cavities": 4, "cycle": 21, "weight": 0.45, "pieces_per_hour_goal": 686, "mp": "" },
    { "cod": 4157, "client": "PARKER", "name": "TAMPA PLASTICA 4 CAVIDADES", "cavities": 4, "cycle": 50, "weight": 0.75, "pieces_per_hour_goal": 288, "mp": "" },
    { "cod": 4158, "client": "PARKER", "name": "TAMPA PLASTICA 5831", "cavities": 4, "cycle": 35, "weight": 0.55, "pieces_per_hour_goal": 411, "mp": "" },
    { "cod": 4935, "client": "PARKER", "name": "TAMPA SUPERIOR PRETA", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 4936, "client": "PARKER", "name": "TAMPA INFERIOR PRETA", "cavities": 4, "cycle": 34.38, "weight": 0.85, "pieces_per_hour_goal": 419, "mp": "" },
    { "cod": 4996, "client": "PARKER", "name": "TAMPA PLASTICA 5923 - PRO85071129", "cavities": 4, "cycle": 40, "weight": 0.65, "pieces_per_hour_goal": 360, "mp": "" },

    // --- GERDAU ---
    { "cod": 233, "client": "GERDAU", "name": "TRAVA DO CARRETEL", "cavities": 2, "cycle": 22, "weight": 0.35, "pieces_per_hour_goal": 327, "mp": "" },
    { "cod": 234, "client": "GERDAU", "name": "ADAPTADOR POLIPROPILENO PARA CARRETEL", "cavities": 1, "cycle": 60, "weight": 0.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 235, "client": "GERDAU", "name": "CARRETEL - OVD (SEM INSCRIÇÃO - C/ ETIQUETA)", "cavities": 1, "cycle": 60, "weight": 0.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 3555, "client": "GERDAU", "name": "CARRETEL", "cavities": 1, "cycle": 60, "weight": 0.25, "pieces_per_hour_goal": 60, "mp": "" },

    // --- HOKKAIDO ---
    { "cod": 3858, "client": "HOKKAIDO", "name": "POTE DE SORVETE BRANCO - CP191", "cavities": 1, "cycle": 9, "weight": 0.85, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 3859, "client": "HOKKAIDO", "name": "TAMPA BRANCA DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 3860, "client": "HOKKAIDO", "name": "POTE DE SORVETE NATURAL - CP191", "cavities": 1, "cycle": 9, "weight": 0.85, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 3861, "client": "HOKKAIDO", "name": "TAMPA NATURAL DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4193, "client": "HOKKAIDO", "name": "TAMPA LILAS DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4194, "client": "HOKKAIDO", "name": "TAMPA LARANJA DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4195, "client": "HOKKAIDO", "name": "TAMPA AZUL DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4198, "client": "HOKKAIDO", "name": "TAMPA VERMELHO DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4199, "client": "HOKKAIDO", "name": "TAMPA AMARELO DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },
    { "cod": 4754, "client": "HOKKAIDO", "name": "TAMPA ROXA DO POTE DE SORVETE - CP191", "cavities": 1, "cycle": 9, "weight": 0.45, "pieces_per_hour_goal": 400, "mp": "" },

    // --- LH COLUS ---
    { "cod": 574, "client": "LH COLUS", "name": "MANOPLA MACA (HANDLER) - LHC 390-20351", "cavities": 1, "cycle": 60, "weight": 0.85, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 575, "client": "LH COLUS", "name": "BARRA TRIPLA CORREDIÇA (SLIDE THREE BAR) - LHC 390-01006", "cavities": 1, "cycle": 30, "weight": 0.65, "pieces_per_hour_goal": 120, "mp": "" },

    // --- CSINFT ---
    { "cod": 4006, "client": "CSINFT", "name": "FACE INTERNA BRANCA CSI - PECA 1", "cavities": 1, "cycle": 42, "weight": 0.35, "pieces_per_hour_goal": 86, "mp": "" },
    { "cod": 4007, "client": "CSINFT", "name": "FACE EXTERNA BRANCA CSI - PECA 2", "cavities": 1, "cycle": 42, "weight": 0.35, "pieces_per_hour_goal": 86, "mp": "" },
    { "cod": 4008, "client": "CSINFT", "name": "TAMPÃO BRANCO CSI - PECA 3", "cavities": 1, "cycle": 42, "weight": 0.35, "pieces_per_hour_goal": 86, "mp": "" },

    // --- JORNADA ---
    { "cod": 3442, "client": "JORNADA", "name": "CONECTOR MODELO V CINZA MOLDE 1 - 30°", "cavities": 4, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 554, "mp": "" },
    { "cod": 3443, "client": "JORNADA", "name": "CONECTOR MODELO R VERDE MOLDE 2 - 120°", "cavities": 8, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 1108, "mp": "" },
    { "cod": 3444, "client": "JORNADA", "name": "CONECTOR MODELO L AMARELO MOLDE 2 - 90°", "cavities": 8, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 1108, "mp": "" },
    { "cod": 3445, "client": "JORNADA", "name": "CONECTOR MODELO X MARROM MOLDE 1 - CRUZ (360°)", "cavities": 4, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 554, "mp": "" },
    { "cod": 3446, "client": "JORNADA", "name": "CONECTOR MODELO T AZUL MOLDE 3 - (180°/90°)", "cavities": 8, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 1108, "mp": "" },
    { "cod": 3447, "client": "JORNADA", "name": "CONECTOR MODELO I VERMELHO MOLDE 3 - RETO (180°)", "cavities": 8, "cycle": 26, "weight": 0.45, "pieces_per_hour_goal": 1108, "mp": "" },

    // --- SUNVISOR ---
    { "cod": 4647, "client": "SUNVISOR", "name": "BASE TRIANGULAR - KG 3", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 4732, "client": "SUNVISOR", "name": "JUNCAO SEM FURO - KG 2", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 4763, "client": "SUNVISOR", "name": "CORREDICA FUNDO VAZADO 6M SEM FURO - KG 4B", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 4764, "client": "SUNVISOR", "name": "CORREDICA FUNDO VAZADO 3M SEM FURO - KG 1B", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 4766, "client": "SUNVISOR", "name": "FIXADOR FUNDO FECHADO 3M SEM FURO - KG 1A", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 4769, "client": "SUNVISOR", "name": "FIXADOR FUNDO FECHADO 6M SEM FURO - KG 4A", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 5800, "client": "SUNVISOR", "name": "JUNCAO SEM FURO - KG 2 REC", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 5802, "client": "SUNVISOR", "name": "BASE TRIANGULAR - KG 3 REC", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 5803, "client": "SUNVISOR", "name": "FIXADOR FUNDO FECHADO 6M SEM FURO - KG 4A REC", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" },
    { "cod": 5805, "client": "SUNVISOR", "name": "CORREDICA FUNDO VAZADO 6M SEM FURO - KG 4B REC", "cavities": 1, "cycle": 60, "weight": 1.25, "pieces_per_hour_goal": 60, "mp": "" }
];

// Catálogo de máquinas (fonte única para app)
const machineDatabase = [
    { id: "H01", model: "SANDRETTO OTTO" },
    { id: "H02", model: "SANDRETTO SERIE 200" },
    { id: "H03", model: "LS LTE280" },
    { id: "H04", model: "LS LTE 330" },
    { id: "H05", model: "LS LTE 170" },
    { id: "H06", model: "HAITIAN MA2000" },
    { id: "H07", model: "CHEN HSONG JM 178 A" },
    { id: "H08", model: "REED 200 TG II" },
    { id: "H09", model: "REED 200 TG II" },
    { id: "H10", model: "HAITIAN MA 3200" },
    { id: "H11", model: "ROMI 300 TGR" },
    { id: "H12", model: "BORCHE BH 120" },
    { id: "H13", model: "HAITIAN MA 2000 770G" },
    { id: "H14", model: "SANDRETTO SB UNO" },
    { id: "H15", model: "ROMI EN 260 CM 10" },
    { id: "H16", model: "HAITIAN MA 2000 III" },
    { id: "H17", model: "ROMI EN 260 CM 10" },
    { id: "H18", model: "HAITIAN MA 2000 III" },
    { id: "H19", model: "HAITIAN MA 2000 III" },
    { id: "H20", model: "HAITIAN PL 200J" },
    { id: "H26", model: "ROMI PRIMAX CM9" },
    { id: "H27", model: "ROMI PRIMAX CM8" },
    { id: "H28", model: "ROMI PRIMAX CM8" },
    { id: "H29", model: "ROMI PRIMAX CM8" },
    { id: "H30", model: "ROMI PRIMAX CM8" },
    { id: "H31", model: "ROMI PRÁTICA CM8" },
    { id: "H32", model: "ROMI PRÁTICA CM8" }
];

// ================================
// TARA DAS CAIXAS PLÁSTICAS (em kilos)
// ================================
const tareBoxesDatabase = [
    { "machine": "H-01", "weight": 3.010 },
    { "machine": "H-02", "weight": 3.165 },
    { "machine": "H-03", "weight": 3.005 },
    { "machine": "H-04", "weight": 3.425 },
    { "machine": "H-05", "weight": 3.030 },
    { "machine": "H-07", "weight": 3.210 },
    { "machine": "H-08", "weight": 3.415 },
    { "machine": "H-09", "weight": 3.030 },
    { "machine": "H-10", "weight": 3.230 },
    { "machine": "H-11", "weight": 3.015 },
    { "machine": "H-12", "weight": 2.985 },
    { "machine": "H-13", "weight": 3.305 },
    { "machine": "H-14", "weight": 3.115 },
    { "machine": "H-15", "weight": 3.240 },
    { "machine": "H-17", "weight": 3.020 },
    { "machine": "H-20", "weight": 3.255 },
    { "machine": "H-26", "weight": 2.985 },
    { "machine": "H-27", "weight": 3.025 },
    { "machine": "H-28", "weight": 3.060 },
    { "machine": "H-29", "weight": 3.265 },
    { "machine": "H-30", "weight": 2.965 },
    { "machine": "H-31", "weight": 3.110 },
    { "machine": "H-32", "weight": 2.910 }
];

// Motivos de perdas (agrupados)
const groupedLossReasons = {
    "PROCESSO": [
        "BOLHA", "CHUPAGEM", "CONTAMINAÇÃO", "DEGRADAÇÃO", "EMPENAMENTO", "FALHA",
        "FIAPO", "FORA DE COR", "INÍCIO/REÍNICIO", "JUNÇÃO", "MANCHAS",
        "MEDIDA FORA DO ESPECIFICADO", "MOÍDO", "PEÇAS PERDIDAS", "QUEIMA", "REBARBA"
    ],
    "FERRAMENTARIA": [
        "DEFORMAÇÃO", "GALHO PRESO", "MARCA D'ÁGUA", "MARCA EXTRATOR", "RISCOS", "SUJIDADE"
    ],
    "QUALIDADE": [
        "INSPEÇÃO DE LINHA"
    ]
};

// Motivos de parada (agrupados)
const groupedDowntimeReasons = {
    "FERRAMENTARIA": ["CORRETIVA DE MOLDE", "PREVENTIVA DE MOLDE", "TROCA DE VERSÃO"],
    "PROCESSO": ["ABERTURA DE CAVIDADE", "AJUSTE DE PROCESSO", "TRY OUT"],
    "COMPRAS": ["FALTA DE INSUMO PLANEJADA", "FALTA DE INSUMO NÃO PLANEJADA"],
    "PREPARAÇÃO": ["AGUARDANDO PREPARAÇÃO DE MATERIAL"],
    "QUALIDADE": ["AGUARDANDO CLIENTE/FORNECEDOR", "LIBERAÇÃO"],
    "MANUTENÇÃO": ["MANUTENÇÃO CORRETIVA", "MANUTENÇÃO PREVENTIVA"],
    "PRODUÇÃO": ["FALTA DE OPERADOR", "TROCA DE COR", "PRENDENDO GALHO"],
    "SETUP": ["INSTALAÇÃO DE MOLDE", "RETIRADA DE MOLDE"],
    "ADMINISTRATIVO": ["FALTA DE ENERGIA"],
    "PCP": ["SEM PROGRAMAÇÃO"],
    "COMERCIAL": ["SEM PEDIDO"]
};

// Função para evitar duplicações
function atualizarDatabase(novosDados) {
    const codigosExistentes = new Set(productDatabase.map(item => item.cod));
    
    novosDados.forEach(novoItem => {
        if (!codigosExistentes.has(novoItem.cod)) {
            productDatabase.push(novoItem);
            codigosExistentes.add(novoItem.cod);
        }
    });
    
    return productDatabase;
}

// ================================
// ÍNDICES PARA BUSCA RÁPIDA
// ================================
// Criar Map para O(1) lookups em vez de O(n) array searches
const productByCode = new Map();
const productByClient = new Map();
const machineById = new Map();
const tareByMachine = new Map();

// Indexar produtos por código
productDatabase.forEach(product => {
    productByCode.set(product.cod, product);
});

// Indexar produtos por cliente
productDatabase.forEach(product => {
    if (!productByClient.has(product.client)) {
        productByClient.set(product.client, []);
    }
    productByClient.get(product.client).push(product);
});

// Indexar máquinas por ID
machineDatabase.forEach(machine => {
    machineById.set(machine.id, machine);
});

// Indexar tara por máquina
tareBoxesDatabase.forEach(tare => {
    tareByMachine.set(tare.machine, tare.weight);
});

// Suporte a Node (tests) e browser
(function(root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        // Ambiente CommonJS (Node)
        module.exports = factory();
    } else {
        // Ambiente browser: expõe no escopo global
        root.databaseModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    return {
        productDatabase,
        atualizarDatabase,
        machineDatabase,
        tareBoxesDatabase,
        groupedLossReasons,
        groupedDowntimeReasons,
        // Expor os índices para busca rápida
        productByCode,
        productByClient,
        machineById,
        tareByMachine
    };

}));
