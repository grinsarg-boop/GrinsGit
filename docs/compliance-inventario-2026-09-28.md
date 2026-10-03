# Inventario de compliance — ads ACTIVE de Meta

_Plan 100M N01-R4-T1. Solo lectura en Meta (GET). Creado 01/10/2026; el nombre del archivo conserva la fecha 28/09 del plan._

## Barrido 01/10/2026

**Fuente.** Graph API v25.0, `GET /act_{id}/ads?effective_status=['ACTIVE']` paginado hasta el final, creative completo (body, title, `object_story_spec`, `asset_feed_spec`) + post (`message`, `call_to_action`, `likes.summary`). Gasto: `time_range` 24/09–30/09/2026 (equivale a `last_7d` del 01/10, anclado al calendario). **Gasto nominal de Meta**, sin impuesto (R3 lleva ~10% desde el 16/09 en `spend_real`; R2 0%).
**Detector.** `riesgoCompliance(...bodies, ...titles, ...descriptions)` y `riesgoDestino(url)` de la rama `compliance-huecos` (worktree `.claude/worktrees/compliance-huecos/app/compliance.mjs`, no en main). Se pasan TODOS los textos del creative (incluidas las variantes de `asset_feed_spec` de los dinámicos). Destino: URL sin query (UTM fuera), bajada una vez por URL; el detector topa en 6 términos por categoría.

### Cobertura (100%)

| cuenta | ads ACTIVE | con hits copy | con hits destino | gasto 7d |
|---|---|---|---|---|
| R2 `act_880189106877616` | 75 | 50 | 75 | $4.279.728 |
| R3 `act_1569698667101520` | 12 | 9 | 12 | $2.212.665 |
| **Total** | **87** | **59** | **87** | **$6.492.393** |

### Gasto 7d con hits

| corte | ads | gasto 7d | % del gasto total |
|---|---|---|---|
| Hits en el copy | 59 | $4.635.581 | 71,4% |
| Hits en el destino (crudo del detector) | 87 | $6.492.393 | 100,0% |
| Hits en el destino sin el falso positivo de dustyrose.com.ar ("0 %" de cuotas) | 79 | $6.275.300 | 96,7% |
| Copy o destino | 87 | $6.492.393 | 100,0% |
| Sin ningún hit | 0 | $0 | 0,0% |

### Hits del copy más repetidos

| cat:término | ads | gasto 7d de esos ads |
|---|---|---|
| imagen corporal:panza | 53 | $4.421.676 |
| segunda persona sobre el cuerpo:tu cuerpo | 25 | $1.580.675 |
| afirmación de salud:inflamación | 22 | $1.366.770 |
| afirmación de salud:eliminar | 21 | $1.366.770 |
| afirmación de salud:garantizado | 7 | $331.715 |
| afirmación de salud:milagroso | 4 | $213.905 |
| afirmación de salud:milagros | 4 | $213.905 |
| kilos/medidas con plazo:10 cm | 4 | $213.905 |
| afirmación de salud:eliminaron | 3 | $94.933 |
| afirmación de salud:regeneración | 1 | $0 |
| afirmación de salud:regeneran | 1 | $0 |
| afirmación de salud:desinflaman | 1 | $0 |
| segunda persona sobre el cuerpo:tu piel | 1 | $0 |
| estadística de eficacia:10% | 1 | $0 |
| afirmación de salud:desinflama | 1 | $0 |

### Destinos (PDPs), una fila por URL

| cód | URL | HTTP | ads | gasto 7d | hits del destino |
|---|---|---|---|---|---|
| D1 | https://dustyrose.com.ar/ | 200 | 8 | $217.093 | estadística de eficacia:0 % — **falso positivo**: es el badge "cuotas - 0 %" |
| D2 | https://biolabsarg.com/products/purezadrops™-drena-naturalmente-la-hinchazon-del-rostro-abdomen-y-piernas-1 | 200 | 38 | $4.236.724 | afirmación de salud:eliminar · afirmación de salud:equilibrar las hormonas · afirmación de salud:desinflamación · afirmación de salud:eliminación · afirmación de salud:inflamación · afirmación de salud:equilibrar hormonas · segunda persona sobre el cuerpo:tu cuerpo · segunda persona sobre el cuerpo:tu cara · segunda persona sobre el cuerpo:tu rostro · estadística de eficacia:100% · estadística de eficacia:87% |
| D3 | https://biolabsarg.com/products/bee-venom-4 | 200 | 5 | $213.905 | afirmación de salud:Regenera · afirmación de salud:producción de colágeno · afirmación de salud:reparación celular · afirmación de salud:regeneración · afirmación de salud:inflamación · afirmación de salud:tratamientos · condición médica nombrada:Psoriasis · condición médica nombrada:eccema · condición médica nombrada:dermatitis · segunda persona sobre el cuerpo:tu piel |
| D4 | https://biolabsarg.com/products/natures-sunrise™-drena-naturalmente-la-hinchazon-del-rostro-abdomen-y-piernas | 200 | 35 | $1.824.671 | afirmación de salud:eliminar · afirmación de salud:equilibrar las hormonas · afirmación de salud:desinflamación · afirmación de salud:eliminación · afirmación de salud:inflamación · afirmación de salud:equilibrar hormonas · segunda persona sobre el cuerpo:tu cuerpo · segunda persona sobre el cuerpo:tu cara · segunda persona sobre el cuerpo:tu rostro · estadística de eficacia:100% · estadística de eficacia:87% |
| D5 | https://biolabsarg.com/products/veinguard-herbal-spray-2x1-desinflama-y-mejora-la-circulacion | 200 | 1 | $0 | afirmación de salud:desinflama · condición médica nombrada:Psoriasis · segunda persona sobre el cuerpo:tu cuerpo · segunda persona sobre el cuerpo:tu piel |

Notas de destino: en PurezaDrops y Natures Sunrise (misma plantilla) el "100%" es composición ("100% a base de extractos herbales", "100% veganas") y escapa a la excepción del detector porque no va seguido de "natural"; el "87%" sí es estadística de eficacia ("87% de las mujeres sienten el cambio desde…"). En VeinGuard, "Psoriasis" no apareció en el texto visible con un strip simple: probablemente viene del menú/colección o de un meta; no verificado.

### Ranking: 10 ads con más gasto 7d con hits

Como los 5 destinos tienen hits, "con hits" por destino es casi todo el inventario. Van dos cortes.

**a) Copy o destino**

| # | ad | cuenta | $ 7d | hits copy | destino |
|---|---|---|---|---|---|
| 1 | 120251061752020152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open | R2 | $550.774 | 0 | D2 (11) |
| 2 | 120251177936560257 pureza-02-mix-base-v02 (reuse sinx1) | R3 | $514.452 | 1 | D2 (11) |
| 3 | 120251002076080257 pureza-02-foto-hotsale-v03 (reuse) | R3 | $403.359 | 1 | D2 (11) |
| 4 | 120251245846860257 pureza-montaje-M5 | R3 | $373.761 | 0 | D2 (11) |
| 5 | 120251551924440152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open-dup50k | R2 | $327.955 | 0 | D2 (11) |
| 6 | 120244910404020152 cbo-cv02-pureza-02-purezadrops--angv01-foto-base-v01-mujeres25-45 | R2 | $313.370 | 4 | D2 (11) |
| 7 | 120244875723400152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v01-mujeres25-45 | R2 | $306.084 | 4 | D2 (11) |
| 8 | 120247814617900152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v04-mix25-45-122126089455156780 | R2 | $275.174 | 1 | D4 (11) |
| 9 | 120245299501110152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v02-mujeres25-45 | R2 | $274.034 | 4 | D2 (11) |
| 10 | 120249883219690152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | $241.668 | 1 | D4 (11) |

**b) Solo copy**

| # | ad | cuenta | $ 7d | hits copy |
|---|---|---|---|---|
| 1 | 120251177936560257 pureza-02-mix-base-v02 (reuse sinx1) | R3 | $514.452 | imagen corporal:panza |
| 2 | 120251002076080257 pureza-02-foto-hotsale-v03 (reuse) | R3 | $403.359 | imagen corporal:panza |
| 3 | 120244910404020152 cbo-cv02-pureza-02-purezadrops--angv01-foto-base-v01-mujeres25-45 | R2 | $313.370 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo |
| 4 | 120244875723400152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v01-mujeres25-45 | R2 | $306.084 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo |
| 5 | 120247814617900152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v04-mix25-45-122126089455156780 | R2 | $275.174 | imagen corporal:panza |
| 6 | 120245299501110152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v02-mujeres25-45 | R2 | $274.034 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo |
| 7 | 120249883219690152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | $241.668 | imagen corporal:panza |
| 8 | 120247127248060152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | $224.394 | imagen corporal:panza |
| 9 | 120249882938780152 cbo-cv01-natures-01-angv02-video-base-v03-mujeres25-45-120244875576650152 | R2 | $208.840 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo |
| 10 | 120251005273100257 pureza-02-mix-base-v02 (reuse volumen) | R3 | $197.296 | imagen corporal:panza |

### Typo "Sock Limitado"

7 ads, $331.715 en 7d, todos R2. Titular exacto: "Sock Limitado 🚨".

| ad | ad set | $ 7d | creado |
|---|---|---|---|
| 120249882938780152 cbo-cv01-natures-01-angv02-video-base-v03-mujeres25-45-120244875576650152 | cbo-cv01-natures-01-angv02-video-base | $208.840 | 2026-07-03 |
| 120249882938680152 cbo-cv01-natures-01-angv01-video-base-v03-mujeres25-45 | cbo-cv01-natures-01-angv01-video-base | $63.596 | 2026-07-03 |
| 120249882938750152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | cbo-cv01-natures-01-angv08-video-base | $57.907 | 2026-07-03 |
| 120249882938670152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | cbo-cv01-natures-01-angv08-video-base | $1.219 | 2026-07-03 |
| 120249882938690152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | cbo-cv01-natures-01-angv01-video-base | $91 | 2026-07-03 |
| 120249882938700152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | cbo-cv01-natures-01-angv01-video-base | $57 | 2026-07-03 |
| 120249882938660152 cbo-cv01-natures-01-angv08-video-base-v03-mujeres25-45 | cbo-cv01-natures-01-angv08-video-base | $6 | 2026-07-03 |

### Titulares de urgencia permanente

Titular de escasez/plazo corriendo sin fecha de fin. "Creado más viejo" = el ad ACTIVE más antiguo que lo lleva.

| titular | ads | gasto 7d | creado más viejo |
|---|---|---|---|
| ÚLTIMOS DÍAS DE OFERTA | 39 | $3.117.992 | 2026-03-21 |
| últimos días de oferta de Verano! | 9 | $996.792 | 2026-03-21 |
| Sock Limitado 🚨 | 7 | $331.715 | 2026-07-03 |
| 🚨 Últimas unidades | 5 | $213.905 | 2026-05-23 |
| Stock Limitado 🚨 | 4 | $37.322 | 2026-07-03 |
| HOT SALE🔥 | 2 | $20.747 | 2026-07-03 |
| Últimas Unidades 🚨 | 1 | $0 | 2026-02-05 |

Total: 55 ads con al menos un titular de urgencia, $3.942.034 (60,7% del gasto). "últimos días de oferta de Verano!" corre en primavera; "HOT SALE🔥" es del Hot Sale de mayo. Ninguna de estas categorías la mira el detector.

### Body M5 — contador sin respaldo

Body: "40.000+ mujeres ya dejaron de sentirse hinchadas todo el día — solo ¼ de cucharadita de … al agua…". Es copia literal de un anuncio de somospureza activo desde oct-2025 (ver `40-Legal/Marca-PUREZADROPS.md:124`). Se marca como **contador sin respaldo**; no se propone edición.

- M5 (PurezaDrops literal, o la misma frase con Natures Sunrise): **69 ads, $6.010.283** (92,6%). De esos, 52 llevan la versión PurezaDrops ($5.154.652). En 43 es el único body del ad ($4.548.159); en el resto entra como una de las variantes de `asset_feed_spec` (dinámicos: Meta rota bodies, no se sabe cuánto gasto fue a cada variante).
- Otras redacciones con el mismo contador "40.000" ("Más de 40.000 mujeres ya probaron…", "+40.000 mujeres ya le dijeron CHAU…", "Descubre el secreto de 40.000+…"): **0 ads, $0** (0,0%).
- El detector no tiene regla para contadores de usuarios. Tampoco agarra "respaldo científico", que aparece en la variante "Más de 40.000 mujeres ya probaron … acción rápida y respaldo científico".

| ad | cuenta | $ 7d | versión | dónde |
|---|---|---|---|---|
| 120251061752020152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open | R2 | $550.774 | PurezaDrops | único body |
| 120251177936560257 pureza-02-mix-base-v02 (reuse sinx1) | R3 | $514.452 | PurezaDrops | único body |
| 120251002076080257 pureza-02-foto-hotsale-v03 (reuse) | R3 | $403.359 | PurezaDrops | único body |
| 120251245846860257 pureza-montaje-M5 | R3 | $373.761 | PurezaDrops | único body |
| 120251551924440152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open-dup50k | R2 | $327.955 | PurezaDrops | único body |
| 120244910404020152 cbo-cv02-pureza-02-purezadrops--angv01-foto-base-v01-mujeres25-45 | R2 | $313.370 | PurezaDrops | una de 4 variantes |
| 120244875723400152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v01-mujeres25-45 | R2 | $306.084 | PurezaDrops | una de 4 variantes |
| 120247814617900152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v04-mix25-45-122126089455156780 | R2 | $275.174 | Natures Sunrise | único body |
| 120245299501110152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v02-mujeres25-45 | R2 | $274.034 | PurezaDrops | una de 4 variantes |
| 120249883219690152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | $241.668 | PurezaDrops | único body |
| 120251590257120152 cbo-cv04-pureza-02-purezadrops-m5iter-estatica-a2-v01-fixy-122141309907156780 | R2 | $236.108 | PurezaDrops | único body |
| 120247127248060152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | $224.394 | PurezaDrops | único body |
| 120249882938780152 cbo-cv01-natures-01-angv02-video-base-v03-mujeres25-45-120244875576650152 | R2 | $208.840 | Natures Sunrise | una de 6 variantes |
| 120251005273100257 pureza-02-mix-base-v02 (reuse volumen) | R3 | $197.296 | PurezaDrops | único body |
| 120251002114550257 natures-01-5500-foto-v03 (reuse) | R3 | $170.846 | PurezaDrops | único body |
| 120249883219750152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $162.604 | PurezaDrops | único body |
| 120251005514430257 natures-01-5000-foto-v04 (reuse volumen) | R3 | $159.379 | Natures Sunrise | único body |
| 120251002067670257 pureza-02-video-v01 (reuse) | R3 | $118.728 | PurezaDrops | único body |
| 120251005275130257 pureza-02-mix-base-v02 (reuse volumen) | R3 | $101.972 | PurezaDrops | único body |
| 120251177938360257 pureza-02-video-v01 (reuse sinx1) | R3 | $99.923 | PurezaDrops | único body |
| 120249883219720152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v02-mix25-45-122121597915156780 | R2 | $89.441 | PurezaDrops | una de 3 variantes |
| 120243737909300152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v02-mujeres25-45 | R2 | $73.732 | PurezaDrops | una de 4 variantes |
| 120251002089450257 pureza-02-video-v01 (reuse) | R3 | $71.536 | PurezaDrops | único body |
| 120246958755600152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $66.096 | PurezaDrops | único body |
| 120249882938680152 cbo-cv01-natures-01-angv01-video-base-v03-mujeres25-45 | R2 | $63.596 | Natures Sunrise | una de 8 variantes |
| 120249882938750152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | R2 | $57.907 | Natures Sunrise | una de 8 variantes |
| 120245297479370152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v04-mix25-45-122126089455156780 | R2 | $50.679 | Natures Sunrise | único body |
| 120251061752210152 cbo-cv03-pureza-02-purezadrops-m5iter-video-b2-v01-open | R2 | $43.114 | PurezaDrops | único body |
| 120251590258190152 cbo-cv04-pureza-02-purezadrops-m5-video-base-v01-fixy-122138619351156780 | R2 | $41.646 | PurezaDrops | único body |
| 120247127248030152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v01-mix25-45-2 122121248145156780 | R2 | $32.698 | PurezaDrops | único body |
| 120249882938560152 cbo-cv01-natures-01-angv04-foto-base-v01-mujeres25-45-2122121248145156780 | R2 | $25.551 | PurezaDrops | único body |
| 120251590257510152 cbo-cv04-pureza-02-purezadrops-angv01-mix-base-v01-fixy-122126091885156780 | R2 | $22.989 | PurezaDrops | una de 4 variantes |
| 120249882938710152 cbo-cv01-natures-01-angv06-foto-hotsale-v02-mujeres25-45 | R2 | $20.595 | Natures Sunrise | una de 4 variantes |
| 120246958755590152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v03-mix25-45-122955433156780 | R2 | $18.472 | PurezaDrops | único body |
| 120249883219740152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v03-mix25-45-122955433156780 | R2 | $16.577 | PurezaDrops | único body |
| 120249882938740152 cbo-cv01-natures-01-angv05-foto-base-v04-mujeres25-45 | R2 | $16.567 | Natures Sunrise | una de 4 variantes |
| 120251590257220152 cbo-cv04-pureza-02-purezadrops-m5iter-estatica-a2-v01-caba-122141309907156780 | R2 | $10.831 | PurezaDrops | único body |
| 120249883219650152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v02-mix25-45-122121597915156780 | R2 | $5.114 | PurezaDrops | una de 3 variantes |
| 120245299510320152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v03-mujeres25-45 | R2 | $4.080 | PurezaDrops | una de 4 variantes |
| 120249883219600152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $2.621 | PurezaDrops | único body |
| 120249883219710152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $2.376 | PurezaDrops | único body |
| 120251590260490152 cbo-cv04-pureza-02-purezadrops-m5-video-base-v01-caba-122138619351156780 | R2 | $2.277 | PurezaDrops | único body |
| 120249882938480152 cbo-cv01-natures-01-angv03-foto-base-v01-mujeres25-45-122122955433156780 | R2 | $1.987 | PurezaDrops | una de 4 variantes |
| 120249882938670152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | R2 | $1.219 | Natures Sunrise | una de 8 variantes |
| 120249883219670152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v03-mix25-45-122955433156780 | R2 | $1.214 | PurezaDrops | único body |
| 120249882938810152 cbo-cv01-natures-01-angv02-video-base-v02-mujeres25-45 | R2 | $942 | Natures Sunrise | una de 4 variantes |
| 120249883219760152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v01-mix25-45-2 122121248145156780 | R2 | $784 | PurezaDrops | único body |
| 120251243461690257 pureza-estatica-A-panza-hinchada | R3 | $757 | PurezaDrops | único body |
| 120244897572580152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $702 | PurezaDrops | único body |
| 120251243454090257 pureza-estatica-B-no-drenas | R3 | $654 | PurezaDrops | único body |
| 120245297440620152 cxr-cv01-natures-01-naturessunrise-4000-mix-base-v04-mix25-45-122126089455156780 | R2 | $410 | Natures Sunrise | una de 2 variantes |
| 120249883219780152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v02-mix25-45-122126093709156780 | R2 | $379 | PurezaDrops | único body |
| 120245288174820152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v02-mix25-45-122121597915156780 | R2 | $378 | PurezaDrops | una de 3 variantes |
| 120245299470230152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v01-mujeres25-45 | R2 | $308 | PurezaDrops | una de 4 variantes |
| 120251061752410152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c1-v01-open | R2 | $286 | PurezaDrops | único body |
| 120251061745990152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-fixy | R2 | $224 | PurezaDrops | único body |
| 120251061752530152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c2-v01-open | R2 | $218 | PurezaDrops | único body |
| 120251590257630152 cbo-cv04-pureza-02-purezadrops-angv01-mix-base-v01-caba-122126091885156780 | R2 | $208 | PurezaDrops | una de 4 variantes |
| 120249882938650152 cbo-cv01-natures-01-angv06-foto-hotsale-v01-mujeres25-45 | R2 | $152 | Natures Sunrise | una de 4 variantes |
| 120249882938690152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | R2 | $91 | Natures Sunrise | una de 8 variantes |
| 120244897563220152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v01-mix25-45-2 122121248145156780 | R2 | $70 | PurezaDrops | único body |
| 120249882938700152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | R2 | $57 | Natures Sunrise | una de 8 variantes |
| 120249883219700152 cxr-cv01-natures-01-naturessunrise-4000-mix-base-v04-mix25-45-122126089455156780 | R2 | $12 | Natures Sunrise | una de 2 variantes |
| 120249882938790152 cbo-cv01-natures-01-angv05-foto-base-v01-mujeres25-45 | R2 | $7 | Natures Sunrise | una de 4 variantes |
| 120249882938660152 cbo-cv01-natures-01-angv08-video-base-v03-mujeres25-45 | R2 | $6 | Natures Sunrise | una de 8 variantes |
| 120251061751010152 cbo-cv03-pureza-02-purezadrops-m5iter-video-b2-v01-fixy | R2 | $3 | PurezaDrops | único body |
| 120251061751430152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c2-v01-fixy | R2 | $0 | PurezaDrops | único body |
| 120251061751170152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c1-v01-fixy | R2 | $0 | PurezaDrops | único body |
| 120244897634000152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v03-mix25-45-122955433156780 | R2 | $0 | PurezaDrops | único body |

### Tabla completa (orden: gasto 7d)

Destino: código de la tabla de PDPs y cantidad de hits. Contador: `M5` = body M5 literal, `40k` = otra redacción del contador. Likes: `s/d` = página Dusty Rose (1587244884889198), el token no tiene `pages_read_engagement` sobre ella.

| ad (id + nombre) | cuenta | ad set | $ 7d | likes del post | hits del copy (cat:término) | hits del destino | reuse |
|---|---|---|---|---|---|---|---|
| 120251061752020152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open | R2 | pureza-m5iter-OPEN-AR-excl4prov | $550.774 | 117 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251177936560257 pureza-02-mix-base-v02 (reuse sinx1) | R3 | sinx1-pureza-RESTO-AR-sinFixy-2545 | $514.452 | 6545 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251002076080257 pureza-02-foto-hotsale-v03 (reuse) | R3 | keepalive-pureza-RESTO-AR-sinFixy-2545 | $403.359 | 1762 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251245846860257 pureza-montaje-M5 | R3 | pureza-mixto-fixy+urbano-20k | $373.761 | 2326 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251551924440152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open-dup50k | R2 | pureza-m5iter-OPEN-AR-excl4prov-dup50k | $327.955 | 117 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120244910404020152 cbo-cv02-pureza-02-purezadrops--angv01-foto-base-v01-mujeres25-45 | R2 | cbo-cv02-pureza-02-purezadrops--angv01-foto-base | $313.370 | 2945 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120244875723400152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v01-mujeres25-45 | R2 | abo-cv01-pureza-02-purezadrops-angv01-mix-base | $306.084 | 2580 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120247814617900152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v04-mix25-45-122126089455156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $275.174 | 11720 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120245299501110152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v02-mujeres25-45 | R2 | cbo-cv02-pureza-02-purezadrops--angv01-video-base | $274.034 | 4283 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120249883219690152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | cxr-cv01-natures-01-naturessunrise-5500-foto-base | $241.668 | 1475 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251590257120152 cbo-cv04-pureza-02-purezadrops-m5iter-estatica-a2-v01-fixy-122141309907156780 | R2 | pureza-cv04-FIXY-CPs-GBA+CABA | $236.108 | 117 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120247127248060152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03-mix25-45-122121597915156780 | R2 | cxr-cv01-natures-01-naturessunrise-5500-foto-base | $224.394 | 1475 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938780152 cbo-cv01-natures-01-angv02-video-base-v03-mujeres25-45-120244875576650152 | R2 | cbo-cv01-natures-01-angv02-video-base | $208.840 | 2141 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251005273100257 pureza-02-mix-base-v02 (reuse volumen) | R3 | keepalive-pureza-FIXY-GBA+CABA-2545 | $197.296 | 6545 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251002114550257 natures-01-5500-foto-v03 (reuse) | R3 | keepalive-natures-RESTO-AR-sinFixy-mujeres-2545 | $170.846 | 1475 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) | (reuse) |
| 120251413610010152 DR estatico 1 | R2 | Dusty Conjunto 1 | $170.116 | s/d | — | D1 (1) |  |
| 120249883219750152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $162.604 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251005514430257 natures-01-5000-foto-v04 (reuse volumen) | R3 | keepalive-natures-RESTO-AR-sinFixy-mujeres-2545 | $159.379 | 11720 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) | (reuse) |
| 120251002067670257 pureza-02-video-v01 (reuse) | R3 | keepalive-pureza-FIXY-GBA+CABA-2545 | $118.728 | 4010 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251005275130257 pureza-02-mix-base-v02 (reuse volumen) | R3 | keepalive-pureza-RESTO-AR-sinFixy-2545 | $101.972 | 6545 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251177938360257 pureza-02-video-v01 (reuse sinx1) | R3 | sinx1-pureza-RESTO-AR-sinFixy-2545 | $99.923 | 4010 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120251179267750152 beevenom-video-AM-santi6-2-open | R2 | beevenom-OPEN-AR-sinFixy-40k | $91.504 | 164 | afirmación de salud:milagroso · afirmación de salud:milagros · kilos/medidas con plazo:10 cm · segunda persona sobre el cuerpo:tu cuerpo | D3 (10) |  |
| 120249883219720152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v02-mix25-45-122121597915156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $89.441 | 3713 | imagen corporal:panza · afirmación de salud:eliminaron · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251164936780152 beevenom-Foto-E1-santi1-open | R2 | beevenom-OPEN-AR-sinFixy-40k | $88.325 | 223 | afirmación de salud:milagros · afirmación de salud:milagroso · kilos/medidas con plazo:10 cm · segunda persona sobre el cuerpo:tu cuerpo | D3 (10) |  |
| 120243737909300152 abo-cv01-pureza-02-purezadrops-angv01-mix-base-v02-mujeres25-45 | R2 | abo-cv01-pureza-02-purezadrops-angv01-mix-base | $73.732 | 6545 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251002089450257 pureza-02-video-v01 (reuse) | R3 | keepalive-pureza-RESTO-AR-sinFixy-2545 | $71.536 | 4010 | imagen corporal:panza · **contador sin respaldo (M5)** | D2 (11) | (reuse) |
| 120246958755600152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $66.096 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938680152 cbo-cv01-natures-01-angv01-video-base-v03-mujeres25-45 | R2 | cbo-cv01-natures-01-angv01-video-base | $63.596 | 274 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938750152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | R2 | cbo-cv01-natures-01-angv08-video-base | $57.907 | 1048 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120245297479370152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v04-mix25-45-122126089455156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $50.679 | 11720 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251061752210152 cbo-cv03-pureza-02-purezadrops-m5iter-video-b2-v01-open | R2 | pureza-m5iter-OPEN-AR-excl4prov | $43.114 | 129 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251590258190152 cbo-cv04-pureza-02-purezadrops-m5-video-base-v01-fixy-122138619351156780 | R2 | pureza-cv04-FIXY-CPs-GBA+CABA | $41.646 | 2326 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120247127248030152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-5500-foto-base | $32.698 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251179243170152 beevenom-video-AM-santi1-2-open | R2 | beevenom-OPEN-AR-sinFixy-40k | $27.093 | 76 | afirmación de salud:milagroso · afirmación de salud:milagros · kilos/medidas con plazo:10 cm · segunda persona sobre el cuerpo:tu cuerpo | D3 (10) |  |
| 120249882938560152 cbo-cv01-natures-01-angv04-foto-base-v01-mujeres25-45-2122121248145156780 | R2 | cbo-cv01-natures-01-angv04-foto-base | $25.551 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251590257510152 cbo-cv04-pureza-02-purezadrops-angv01-mix-base-v01-fixy-122126091885156780 | R2 | pureza-cv04-FIXY-CPs-GBA+CABA | $22.989 | 2580 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120249882938710152 cbo-cv01-natures-01-angv06-foto-hotsale-v02-mujeres25-45 | R2 | cbo-cv01-natures-01-angv06-foto-hotsale | $20.595 | 46 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251621417980152 p12-b-piernas-livianas | R2 | pureza-p12-piernas-livianas-open-ar | $20.403 | 4 | — | D2 (11) |  |
| 120246958755590152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v03-mix25-45-122955433156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $18.472 | 299 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219740152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v03-mix25-45-122955433156780 | R2 | cxr-cv01-natures-01-naturessunrise-5000-mix-base | $16.577 | 299 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938740152 cbo-cv01-natures-01-angv05-foto-base-v04-mujeres25-45 | R2 | cbo-cv01-natures-01-angv05-foto-base | $16.567 | 35 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251621376060152 p7-b-no-es-grasa | R2 | pureza-p7-no-es-grasa-open-ar | $15.645 | 5 | — | D2 (11) |  |
| 120251623980900152 Carrusel 3 | R2 | Dusty Conjunto 2 - CARRUSEL | $12.558 | s/d | — | D1 (1) |  |
| 120251590257220152 cbo-cv04-pureza-02-purezadrops-m5iter-estatica-a2-v01-caba-122141309907156780 | R2 | pureza-cv04-FIXY-CABA-solo | $10.831 | 117 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251623770120152 Carrusel 1 | R2 | Dusty Conjunto 2 - CARRUSEL | $10.267 | s/d | — | D1 (1) |  |
| 120251621374110152 p7-a-no-es-grasa | R2 | pureza-p7-no-es-grasa-open-ar | $9.950 | 3 | — | D2 (11) |  |
| 120251179269130152 beevenom-video-AM-malena2-2-open | R2 | beevenom-OPEN-AR-sinFixy-40k | $6.984 | 4 | afirmación de salud:milagroso · afirmación de salud:milagros · kilos/medidas con plazo:10 cm · segunda persona sobre el cuerpo:tu cuerpo | D3 (10) |  |
| 120251413753330152 DR estatico 5 | R2 | Dusty Conjunto 1 | $6.784 | s/d | — | D1 (1) |  |
| 120251413745890152 DR estatico 3 | R2 | Dusty Conjunto 1 | $6.373 | s/d | — | D1 (1) |  |
| 120249883219650152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v02-mix25-45-122121597915156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $5.114 | 3713 | imagen corporal:panza · afirmación de salud:eliminaron · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251621380810152 p12-a-piernas-livianas | R2 | pureza-p12-piernas-livianas-open-ar | $5.113 | 2 | — | D2 (11) |  |
| 120251413749210152 DR estatico 4 | R2 | Dusty Conjunto 1 | $4.430 | s/d | — | D1 (1) |  |
| 120245299510320152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v03-mujeres25-45 | R2 | cbo-cv02-pureza-02-purezadrops--angv01-video-base | $4.080 | 519 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251413739020152 DR estatico 2 | R2 | Dusty Conjunto 1 | $3.667 | s/d | — | D1 (1) |  |
| 120251623976630152 Carrusel 2 | R2 | Dusty Conjunto 2 - CARRUSEL | $2.899 | s/d | — | D1 (1) |  |
| 120249883219600152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $2.621 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219710152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-4000-mix-base | $2.376 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251590260490152 cbo-cv04-pureza-02-purezadrops-m5-video-base-v01-caba-122138619351156780 | R2 | pureza-cv04-FIXY-CABA-solo | $2.277 | 2326 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120249882938480152 cbo-cv01-natures-01-angv03-foto-base-v01-mujeres25-45-122122955433156780 | R2 | cbo-cv01-natures-01-angv03-foto-base | $1.987 | 15 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938670152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | R2 | cbo-cv01-natures-01-angv08-video-base | $1.219 | 113 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219670152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v03-mix25-45-122955433156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $1.214 | 299 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938810152 cbo-cv01-natures-01-angv02-video-base-v02-mujeres25-45 | R2 | cbo-cv01-natures-01-angv02-video-base | $942 | 349 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219760152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-5500-foto-base | $784 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251243461690257 pureza-estatica-A-panza-hinchada | R3 | pureza-mixto-fixy+urbano-20k | $757 | 9 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120244897572580152 cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-4000-mix-base | $702 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251243454090257 pureza-estatica-B-no-drenas | R3 | pureza-mixto-fixy+urbano-20k | $654 | 21 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120245297440620152 cxr-cv01-natures-01-naturessunrise-4000-mix-base-v04-mix25-45-122126089455156780 | R2 | cxr-cv01-natures-01-naturessunrise-4000-mix-base | $410 | 11720 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219780152 cxr-cv01-natures-01-naturessunrise-5500-foto-base-v02-mix25-45-122126093709156780 | R2 | cxr-cv01-natures-01-naturessunrise-5500-foto-base | $379 | 371 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120245288174820152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v02-mix25-45-122121597915156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $378 | 3713 | imagen corporal:panza · afirmación de salud:eliminaron · **contador sin respaldo (M5)** | D2 (11) |  |
| 120245299470230152 cbo-cv02-pureza-02-purezadrops--angv01-video-base-v01-mujeres25-45 | R2 | cbo-cv02-pureza-02-purezadrops--angv01-video-base | $308 | 113 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251061752410152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c1-v01-open | R2 | pureza-m5iter-OPEN-AR-excl4prov | $286 | 1 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251061745990152 cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-fixy | R2 | pureza-m5iter-FIXY-GBA+CABA | $224 | 1 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251061752530152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c2-v01-open | R2 | pureza-m5iter-OPEN-AR-excl4prov | $218 | 3 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251590257630152 cbo-cv04-pureza-02-purezadrops-angv01-mix-base-v01-caba-122126091885156780 | R2 | pureza-cv04-FIXY-CABA-solo | $208 | 2580 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D2 (11) |  |
| 120249882938650152 cbo-cv01-natures-01-angv06-foto-hotsale-v01-mujeres25-45 | R2 | cbo-cv01-natures-01-angv06-foto-hotsale | $152 | 0 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938690152 cbo-cv01-natures-01-angv01-video-base-v02-mujeres25-45 | R2 | cbo-cv01-natures-01-angv01-video-base | $91 | 2 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120244897563220152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v01-mix25-45-2 122121248145156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $70 | 1718 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938700152 cbo-cv01-natures-01-angv01-video-base-v01-mujeres25-45 | R2 | cbo-cv01-natures-01-angv01-video-base | $57 | 0 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249883219700152 cxr-cv01-natures-01-naturessunrise-4000-mix-base-v04-mix25-45-122126089455156780 | R2 | cxr-cv01-natures-01-naturessunrise-4000-mix-base | $12 | 11720 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938790152 cbo-cv01-natures-01-angv05-foto-base-v01-mujeres25-45 | R2 | cbo-cv01-natures-01-angv05-foto-base | $7 | 0 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120249882938660152 cbo-cv01-natures-01-angv08-video-base-v03-mujeres25-45 | R2 | cbo-cv01-natures-01-angv08-video-base | $6 | 1 | imagen corporal:panza · afirmación de salud:eliminar · afirmación de salud:inflamación · afirmación de salud:Garantizado · segunda persona sobre el cuerpo:tu cuerpo · **contador sin respaldo (M5)** | D4 (11) |  |
| 120251061751010152 cbo-cv03-pureza-02-purezadrops-m5iter-video-b2-v01-fixy | R2 | pureza-m5iter-FIXY-GBA+CABA | $3 | 129 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251061751430152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c2-v01-fixy | R2 | pureza-m5iter-FIXY-GBA+CABA | $0 | 3 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120251061751170152 cbo-cv03-pureza-02-purezadrops-m5iter-video-c1-v01-fixy | R2 | pureza-m5iter-FIXY-GBA+CABA | $0 | 1 | — · **contador sin respaldo (M5)** | D2 (11) |  |
| 120244897634000152 cxr-cv01-natures-01-naturessunrise-4500-mix-base-v03-mix25-45-122955433156780 | R2 | cxr-cv01-natures-01-naturessunrise-4500-mix-base | $0 | 299 | imagen corporal:panza · **contador sin respaldo (M5)** | D4 (11) |  |
| 120247429616700152 Bee 3 Remake | R2 | Ads 23/5 - Fixy | $0 | 0 | afirmación de salud:inflamación · afirmación de salud:regeneración · afirmación de salud:regeneran · afirmación de salud:desinflaman · segunda persona sobre el cuerpo:tu piel · estadística de eficacia:10% | D3 (10) |  |
| 120241987084700152 V horizontal 122115491811156780 | R2 | 6000 | $0 | 7925 | afirmación de salud:Desinflama | D5 (4) |  |

### Lo que no se pudo ver

- Likes de los 9 ads de la página Dusty Rose (falta `pages_read_engagement` sobre esa página).
- Texto quemado en imagen/video: el detector solo lee copy y landing.
- Gasto con impuesto: todo es nominal de Meta.
