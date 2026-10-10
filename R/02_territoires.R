# Émissions de gaz à effet de serre du territoire de chaque commune, par secteur :
# « Inventaire de gaz à effet de serre territorialisé » (Citepa pour le ministère chargé de l'environnement,
# année 2016, data.ademe.fr), croisé avec la population et le numéro SIREN des communes
# (API Découpage administratif) : docs/data/territoires.tsv.
library(curl)
library(jsonlite)
library(data.table)

JEU <- "https://data.ademe.fr/data-fair/api/v1/datasets/igt-pouvoir-de-rechauffement-global"
lire <- function(url) fromJSON(rawToChar(curl_fetch_memory(url, handle = new_handle(useragent = "suivi-bilan-carbone (projet personnel)", timeout = 300))$content), simplifyVector = TRUE)

morceaux <- list()
url <- paste0(JEU, "/lines?size=10000")
while (!is.null(url)) { d <- lire(url); morceaux[[length(morceaux) + 1]] <- as.data.table(d$results); url <- d[["next"]] }
inv <- rbindlist(morceaux, fill = TRUE)
cat(nrow(inv), "communes dans l'inventaire\n")

secteurs <- c(residentiel = "Résidentiel", tertiaire = "Tertiaire", routier = "Routier", autres_transports = "Autres_transports",
              industrie = "Industrie_hors-énergie", energie = "Energie", agriculture = "Agriculture", dechets = "Déchets")
x <- inv[, .(insee = INSEE_commune)]
for (k in names(secteurs)) x[[k]] <- round(fifelse(is.na(inv[[secteurs[[k]]]]), 0, inv[[secteurs[[k]]]]))

communes <- as.data.table(lire("https://geo.api.gouv.fr/communes?fields=code,siren,population"))
x <- merge(x, communes[, .(insee = code, siren, population)], by = "insee", all.x = TRUE)
cat("Communes de l'inventaire sans correspondance actuelle (fusions depuis 2016) :", x[is.na(siren), .N], "\n")
x <- x[!is.na(siren) & !is.na(population) & population > 0]
fwrite(x, "docs/data/territoires.tsv", sep = "\t", quote = FALSE)
cat(nrow(x), "communes écrites,", round(file.size("docs/data/territoires.tsv") / 1e6, 1), "Mo\n")
