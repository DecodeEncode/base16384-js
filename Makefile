# base16384-js — run `make help` for targets. Needs only a JavaScript runtime;
# `reference` needs git and a C compiler, `serve` uses python3, `licenses` uses gh.

NODE      ?= node
PORT      ?= 8000
REF_TAG   ?= v2.3.2
REFERENCE ?= .reference/base16384
SITE      := _site

.PHONY: help test conformance vectors reference bench images site serve licenses clean

help:
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

test: ## run the test suite
	$(NODE) --test test/*.test.mjs

reference: ## fetch and build the reference tool into .reference/ (comparison only, never committed)
	rm -rf .reference && git clone -q --depth 1 --branch $(REF_TAG) https://github.com/fumiama/base16384.git .reference/src
	cd .reference/src && cc -O2 -DIS_64BIT_PROCESSOR -DBASE16384_VERSION='"$(REF_TAG:v%=%)"' \
	  -DBASE16384_VERSION_DATE='"$(REF_TAG)"' -o ../base16384 base16384.c wrap.c file.c base1464.c

conformance: ## compare with the reference tool on random data (REFERENCE=path)
	REFERENCE=$(REFERENCE) $(NODE) tools/conformance.mjs

vectors: ## regenerate test/vectors.json from the reference tool (REFERENCE=path)
	REFERENCE=$(REFERENCE) $(NODE) tools/vectors.mjs

bench: ## measure throughput on this machine
	$(NODE) tools/bench.mjs

images: ## redraw images/format.svg and images/bench.svg
	$(NODE) tools/diagram.mjs
	$(NODE) tools/bench.mjs --svg

site: ## assemble the published site in _site/
	rm -rf $(SITE) && mkdir -p $(SITE)/v1
	cp -R site/. images $(SITE)/
	cp src/base16384.mjs $(SITE)/
	cp src/base16384.mjs $(SITE)/v1/

serve: site ## build the site and serve it on 127.0.0.1 (PORT=8000)
	cd $(SITE) && python3 -m http.server $(PORT) --bind 127.0.0.1

licenses: ## fetch the licence text verbatim
	gh api licenses/apache-2.0 --jq .body > LICENSE

clean: ## remove build output and the reference build
	rm -rf $(SITE) .reference
