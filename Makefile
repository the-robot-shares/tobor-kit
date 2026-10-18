# tobor-kit root Makefile — cypress isolation validation workflow
WEB := web
REPORT := $(WEB)/cypress/report
RUNLOG := $(REPORT)/cypress-run.log
URL := http://127.0.0.1:8091/e2e/isolation/harness.html

.PHONY: isolation-setup isolation-run isolation-report isolation-open isolation

isolation-setup:
	@echo "== isolation: setup =="
	@if [ ! -d "$(WEB)/node_modules" ]; then \
		echo "-- npm install --"; (cd $(WEB) && npm install) || exit 1; fi
	@echo "-- isolation:importmap --"
	cd $(WEB) && npm run isolation:importmap || exit 1
	@echo "-- build --"
	cd $(WEB) && npm run build || exit 1

isolation-run:
	@echo "== isolation: run =="
	@mkdir -p $(REPORT)
	@if curl -sf $(URL) >/dev/null 2>&1; then \
		echo "-- server already up on 8091 --"; \
	else \
		echo "-- starting isolation:server in background --"; \
		(cd $(WEB); nohup npm run isolation:server >/dev/null 2>&1 & echo $$! > cypress/report/server.pid); \
		ok=0; for i in $$(seq 1 60); do \
			curl -sf $(URL) >/dev/null 2>&1 && { ok=1; break; }; sleep 0.5; done; \
		[ $$ok -eq 1 ] || { echo "server failed to become healthy on 8091" >&2; exit 1; }; \
	fi
	@echo "-- cypress isolation tests --"
	@rm -f $(RUNLOG)
	@(cd $(WEB) && bash -c 'set -o pipefail; npm run test:isolation 2>&1 | tee ../$(RUNLOG)'); \
	status=$$?; \
	for pid in $$(cat $(REPORT)/server.pid 2>/dev/null) $$(lsof -ti :8091 2>/dev/null); do \
		kill $$pid 2>/dev/null; done; \
	rm -f $(REPORT)/server.pid; \
	exit $$status

isolation-report:
	@echo "== isolation: report =="
	@if [ ! -f "$(RUNLOG)" ]; then \
		echo "No run log at $(RUNLOG). Run 'make isolation-run' first." >&2; exit 1; fi
	cd $(WEB) && npm run isolation:report -- --log ../$(RUNLOG) || exit 1
	@echo "-- html report --"
	cd $(WEB) && npm run isolation:report:html -- --log ../$(RUNLOG) || exit 1
	@echo "report: $(REPORT)/tobor-kit-components.mhtml"
	@echo "report: $(REPORT)/artifacts/index.html"

isolation-open:
	@echo "== isolation: open =="
	@test -f "$(REPORT)/artifacts/index.html" || { echo "No report at $(REPORT)/artifacts/index.html. Run 'make isolation-report' first." >&2; exit 1; }
	open $(REPORT)/artifacts/index.html

isolation: isolation-setup isolation-run isolation-report isolation-open
	@echo "== isolation workflow complete =="
