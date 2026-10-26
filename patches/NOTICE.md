# Optional Strata extensions

Base: https://github.com/Niko1221/Strata at `4b9e05a2a806a3fe24f7b2560d98626c37dade35` (v0.2.6).

The patches are derived from the MIT-licensed https://github.com/averyjohnkucan-arch/StrataUnleashed fork:

- `flash-kv-formats.patch`: selected mixed-KV implementation and regression tests from `34ceb4839d131d321164366e58782540afcbacd0`, excluding unrelated fork changes.
- `qwen-int8-kv.patch`: `35d2aa3e4cae6324552e5decba99175ac6f8aef2`.
- `qwen-external-mtp.patch`: external donor validation/loading from `b8a77fcd675161a2a3e13c50ee6d68aa3d0f6bc0`, ported independently to the stock base.

These files do not patch the user's DSH installation or a separate Strata checkout. The builder uses a plugin-owned source copy. CUDA is the qualified build path; HIP, SYCL and Metal are not claimed as supported extension builds. Stock NVFP4 support is unchanged.

## Upstream license

MIT License

Copyright (c) 2026 Niko1221 and the Strata contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
