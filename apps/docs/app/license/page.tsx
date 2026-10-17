import type { Metadata } from "next";
import { DocsPage, DocsShell } from "../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "License",
  description: "BackendFoundry is released under the MIT License."
};

export default function LicensePage() {
  return (
    <DocsShell>
      <DocsPage
        href="/license"
        title="MIT License"
        description="Use, copy, modify and ship BackendFoundry in commercial and open-source projects. Keep the notice below with copies of the code, including source files added by the CLI."
      >
        <div className="not-prose rounded-lg border border-hairline bg-surface-soft p-6 font-mono text-[13px] leading-relaxed text-slate">
          <p>Copyright (c) 2026 BackendFoundry Contributors</p>
          <p className="mt-4">
            Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
            documentation files (the &quot;Software&quot;), to deal in the Software without restriction, including
            without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
            copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
            following conditions:
          </p>
          <p className="mt-4">
            The above copyright notice and this permission notice shall be included in all copies or substantial
            portions of the Software.
          </p>
          <p className="mt-4">
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
            NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
            NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
            IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
            USE OR OTHER DEALINGS IN THE SOFTWARE.
          </p>
        </div>
      </DocsPage>
    </DocsShell>
  );
}
