defmodule ToborKit.Hologram.ChatThreadTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.ChatThread.Thread

  describe "messages_to_turns/2" do
    test "maps messages onto turns with stamp + participant meta prefixed" do
      messages = [
        %{"id" => "m1", "role" => "user", "text" => "hello", "at" => "2026-09-15T10:30:00Z", "participant" => "u1"}
      ]

      participants = [%{"id" => "u1", "name" => "Keith"}]

      turns = Thread.messages_to_turns(messages, participants)

      assert [%{id: "m1", role: "user", created_at: "2026-09-15T10:30:00Z"}] = turns
      assert hd(turns).content == "2026-09-15 10:30 UTC · Keith\nhello"
    end

    test "omits empty meta and prefixes nothing" do
      turns = Thread.messages_to_turns([%{"text" => "bare"}], [])
      assert hd(turns).content == "bare"
    end

    test "unknown participant ids render verbatim; unknown roles coerce to user" do
      turns = Thread.messages_to_turns([%{"role" => "tool", "text" => "x", "participant" => "zz"}], [])

      assert hd(turns).role == "user"
      assert hd(turns).content == "zz\nx"
    end

    test "missing ids fall back to thread-<index>" do
      turns = Thread.messages_to_turns([%{"text" => "a"}, %{"text" => "b"}], [])
      assert Enum.map(turns, & &1.id) == ["thread-0", "thread-1"]
    end
  end

  describe "view_turns/3" do
    test "messages win over turns when nonempty" do
      assert Thread.view_turns([%{"text" => "m"}], [], [%{id: "t"}]) |> hd() |> Map.get(:id) == "thread-0"
    end

    test "turns pass through when messages are empty" do
      assert Thread.view_turns([], [], [%{id: "t"}]) == [%{id: "t"}]
    end
  end

  describe "stamp/1" do
    test "ISO-8601 prefixes format to `YYYY-MM-DD HH:MM UTC`" do
      assert Thread.stamp("2026-09-15T10:30:00Z") == "2026-09-15 10:30 UTC"
    end

    test "non-ISO strings and blanks pass through / blank out" do
      assert Thread.stamp("bogus") == "bogus"
      assert Thread.stamp("") == ""
      assert Thread.stamp(nil) == ""
    end
  end

  describe "coerce_role/1" do
    test "keeps known roles, coerces the rest to user" do
      assert Thread.coerce_role("assistant") == "assistant"
      assert Thread.coerce_role("system") == "system"
      assert Thread.coerce_role("weird") == "user"
      assert Thread.coerce_role(nil) == "user"
    end
  end
end
