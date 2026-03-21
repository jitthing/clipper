cask "clipper" do
  version "0.4.6"
  sha256 "6d9bb40ba110e9713fa93b75300e418a48d7abf186921a6b815e5e5c38205366"

  url "https://github.com/jitthing/clipper/releases/download/v#{version}/Clipper_0.1.0_aarch64.dmg"
  name "Clipper"
  desc "Screenshot tool with smart window detection and inline annotations"
  homepage "https://github.com/jitthing/clipper"

  depends_on macos: ">= :ventura"

  app "Clipper.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Clipper.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.clipper.app",
    "~/Library/Preferences/com.clipper.app.plist",
  ]
end
