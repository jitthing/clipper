cask "clipper" do
  version "0.3.3"
  sha256 "0019dfc4b32d63c1392aa264aed2253c1e0c2fb09216f8e2cc269bbfb8bb49b5"

  url "https://github.com/jitthing/clipper/releases/download/v#{version}/Clipper_0.1.0_aarch64.dmg"
  name "Clipper"
  desc "Screenshot tool with smart window detection and inline annotations"
  homepage "https://github.com/jitthing/clipper"

  depends_on macos: ">= :ventura"

  app "Clipper.app"

  zap trash: [
    "~/Library/Application Support/com.clipper.app",
    "~/Library/Preferences/com.clipper.app.plist",
  ]
end
