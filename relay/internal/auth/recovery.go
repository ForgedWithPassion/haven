package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// Word list for recovery codes (simplified - 256 words for 8 bits of entropy per word)
var words = []string{
	"apple", "arrow", "artist", "autumn", "badge", "banana", "basket", "beach",
	"beacon", "berry", "blanket", "bloom", "bottle", "branch", "breeze", "bridge",
	"bright", "bronze", "brook", "brush", "bubble", "butter", "button", "cabin",
	"cactus", "camera", "candle", "candy", "canvas", "canyon", "carbon", "carpet",
	"carrot", "castle", "cedar", "cherry", "circle", "cliff", "cloud", "clover",
	"cobalt", "coffee", "comet", "cookie", "copper", "coral", "corner", "cotton",
	"crayon", "creek", "cricket", "crown", "crystal", "curtain", "dagger", "dahlia",
	"daisy", "dancer", "dawn", "desert", "diamond", "dolphin", "dragon", "dream",
	"drift", "drum", "eagle", "echo", "eclipse", "ember", "emerald", "falcon",
	"feather", "fern", "fiddle", "field", "fig", "finch", "fire", "flame",
	"flash", "flint", "flower", "flute", "forest", "fossil", "fountain", "fox",
	"frost", "galaxy", "garden", "garnet", "geyser", "ginger", "glacier", "glass",
	"globe", "glory", "glove", "gold", "grape", "grass", "grove", "guitar",
	"hammer", "harbor", "harvest", "hawk", "hazel", "heart", "hedge", "helmet",
	"hero", "hill", "honey", "horizon", "horn", "horse", "ice", "igloo",
	"ink", "iris", "iron", "island", "ivory", "jacket", "jade", "jasmine",
	"jewel", "jungle", "kernel", "kettle", "kite", "koala", "lake", "lamp",
	"lantern", "lark", "laurel", "lava", "leaf", "lemon", "lens", "leopard",
	"light", "lily", "linen", "lion", "lizard", "lotus", "lunar", "magnet",
	"mango", "maple", "marble", "marsh", "meadow", "melon", "mesa", "metal",
	"mirror", "mist", "moon", "moss", "moth", "mountain", "mouse", "muffin",
	"nectar", "needle", "nest", "night", "north", "nova", "oak", "oasis",
	"ocean", "olive", "onyx", "orange", "orchid", "otter", "owl", "palm",
	"panda", "panther", "paper", "path", "peach", "pearl", "pebble", "pepper",
	"piano", "pickle", "pilot", "pine", "planet", "plum", "pond", "poplar",
	"prism", "pumpkin", "puzzle", "quartz", "rabbit", "radar", "rain", "rainbow",
	"raven", "reef", "ribbon", "ridge", "river", "robin", "rock", "rocket",
	"rose", "ruby", "sage", "salmon", "sand", "sapphire", "saturn", "scale",
	"scarlet", "scroll", "shadow", "shell", "silver", "sketch", "sky", "slate",
	"snow", "solar", "spark", "spice", "spider", "spiral", "splash", "spring",
	"spruce", "star", "steam", "stone", "storm", "stream", "sugar", "summit",
	"sun", "sunset", "surf", "swan", "swift", "table", "tango", "temple",
}

// GenerateRecoveryCode creates a 6-word recovery phrase
// Each word provides ~8 bits of entropy, giving ~48 bits total
func GenerateRecoveryCode() (string, error) {
	wordCount := 6
	result := make([]string, wordCount)

	for i := 0; i < wordCount; i++ {
		b := make([]byte, 1)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		idx := int(b[0]) % len(words)
		result[i] = words[idx]
	}

	return strings.Join(result, "-"), nil
}

// HashValue creates a SHA-256 hash of a value and returns it as hex string
func HashValue(value string) string {
	hash := sha256.Sum256([]byte(value))
	return hex.EncodeToString(hash[:])
}
