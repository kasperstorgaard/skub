import { Panel } from "#/components/panel.tsx";

export function PrintPanel() {
  return (
    <Panel className="not-print:hidden bg-transparent pt-fl-0 border-none mb-fl-5">
      <div className="col-[2/3] grid grid-cols-2 gap-fl-3">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-fl-3">
            {Array.from(
              { length: 5 },
              (_, row) => (
                <div key={row} className="flex gap-fl-1 items-end">
                  <span className="border-b border-text-3 pl-2 py-fl-1 w-8 text-00 leading-tight" />
                  <span className="border-b border-text-3 flex-1 pl-2 py-fl-1 text-00 leading-tight" />
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
