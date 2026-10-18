:ets.delete_all_objects(:tobor_kit_consent)
{:ok, _} = ToborKit.TestSupport.OtelCollector.start_link([])
ExUnit.start()
