package room

import (
	"testing"
)

func TestRoom_New(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)

	if r.ID != "room-1" {
		t.Errorf("Expected ID 'room-1', got '%s'", r.ID)
	}
	if r.Name != "General" {
		t.Errorf("Expected name 'General', got '%s'", r.Name)
	}
	if r.Creator != "alice" {
		t.Errorf("Expected creator 'alice', got '%s'", r.Creator)
	}
	if !r.IsPublic {
		t.Error("Expected room to be public")
	}
	// Creator should be auto-added
	if r.MemberCount() != 1 {
		t.Errorf("Expected 1 member (creator), got %d", r.MemberCount())
	}
	if !r.HasMember("user-1") {
		t.Error("Expected creator to be a member")
	}
}

func TestRoom_AddRemoveMember(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)

	// Add bob
	added := r.AddMember("user-2", "bob")
	if !added {
		t.Error("Expected AddMember to return true")
	}
	if r.MemberCount() != 2 {
		t.Errorf("Expected 2 members, got %d", r.MemberCount())
	}

	// Try to add bob again
	added = r.AddMember("user-2", "bob")
	if added {
		t.Error("Expected AddMember to return false for duplicate")
	}

	// Remove bob
	removed := r.RemoveMember("user-2")
	if !removed {
		t.Error("Expected RemoveMember to return true")
	}
	if r.MemberCount() != 1 {
		t.Errorf("Expected 1 member, got %d", r.MemberCount())
	}

	// Try to remove bob again
	removed = r.RemoveMember("user-2")
	if removed {
		t.Error("Expected RemoveMember to return false for non-member")
	}
}

func TestRoom_HasMember(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)

	if !r.HasMember("user-1") {
		t.Error("Expected HasMember to return true for creator")
	}
	if r.HasMember("user-2") {
		t.Error("Expected HasMember to return false for non-member")
	}

	r.AddMember("user-2", "bob")
	if !r.HasMember("user-2") {
		t.Error("Expected HasMember to return true after adding")
	}
}

func TestRoom_IsEmpty(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)

	if r.IsEmpty() {
		t.Error("Expected IsEmpty to return false with creator")
	}

	r.RemoveMember("user-1")
	if !r.IsEmpty() {
		t.Error("Expected IsEmpty to return true after removing all members")
	}
}

func TestRoom_MemberList(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)
	r.AddMember("user-2", "bob")

	list := r.MemberList()
	if len(list) != 2 {
		t.Errorf("Expected 2 members in list, got %d", len(list))
	}

	memberSet := make(map[string]bool)
	for _, id := range list {
		memberSet[id] = true
	}
	if !memberSet["user-1"] || !memberSet["user-2"] {
		t.Error("Expected both user-1 and user-2 in member list")
	}
}

func TestRoom_MemberInfoList(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)
	r.AddMember("user-2", "bob")

	infos := r.MemberInfoList()
	if len(infos) != 2 {
		t.Errorf("Expected 2 member infos, got %d", len(infos))
	}

	usernameSet := make(map[string]bool)
	for _, info := range infos {
		usernameSet[info.Username] = true
	}
	if !usernameSet["alice"] || !usernameSet["bob"] {
		t.Error("Expected both alice and bob in member info list")
	}
}

func TestRoom_Info(t *testing.T) {
	r := New("room-1", "General", "user-1", "alice", true)
	r.AddMember("user-2", "bob")

	info := r.Info()
	if info.RoomID != "room-1" {
		t.Errorf("Expected RoomID 'room-1', got '%s'", info.RoomID)
	}
	if info.Name != "General" {
		t.Errorf("Expected Name 'General', got '%s'", info.Name)
	}
	if info.Creator != "alice" {
		t.Errorf("Expected Creator 'alice', got '%s'", info.Creator)
	}
	if info.MemberCount != 2 {
		t.Errorf("Expected MemberCount 2, got %d", info.MemberCount)
	}
	if !info.IsPublic {
		t.Error("Expected IsPublic to be true")
	}
}
