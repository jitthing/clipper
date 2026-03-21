cask "clipper" do
  version "0.4.7"
  sha256 "614789fb85f04bfb2c4ee79cbf6efa174055e0e26e58ff0e2479aaa46d67d99b"

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
